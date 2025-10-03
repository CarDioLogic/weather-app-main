
const base_geocoding_api_url = 'https://geocoding-api.open-meteo.com/v1/';
const base_openMeteo_api_url = 'https://api.open-meteo.com/v1/';

const mainContainer: HTMLElement | null = document.getElementById('main_container');

let metricUnits: UnitsDict = {
  temperature: "celsius",
  wind_speed: "kmh",
  precipitation: "mm"
}
let imperialUnits: UnitsDict = {
  temperature: "fahrenheit",
  wind_speed: "mph",
  precipitation: "inch"
}

let unitsDict: UnitsDict = {
  temperature: "celsius",
  wind_speed: "kmh",
  precipitation: "mm"
};

let currentLocation: location = {
    name: "",
    country: "",
    timezone: null,
    coordinates: {
        latitude: "",
        longitude:  "",
    }
}

let selectedDate = new Date(); //i think this is basically just a currentDate (not current selected)

let hourlyForecast:any;

// let hourlyForecast: SimpleForecast[]; //for all week - forecast by hour

function isMetricUnits(dict: UnitsDict): boolean {
  return Object.keys(metricUnits).every(
    (key) => dict[key as keyof UnitsDict] === metricUnits[key as keyof UnitsDict]
  );
}

function updateUnitsOnLocalStorage() {
    (Object.keys(unitsDict) as (keyof UnitsDict)[]).forEach((key) => {
        localStorage.setItem(key, unitsDict[key])
    });

    renderUnitsOptionsContainer();
}

async function init(){
    await initCurrentLocation();
    renderUnitsOptionsContainer();
    initLocationOptionsContainer();
    setupEvents();
    await getForecast(); //initial forecast call with current location
}

function getCurrentCoordinates(): Promise<void> {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLocation.coordinates.latitude = String(position.coords.latitude);
                currentLocation.coordinates.longitude = String(position.coords.longitude);
                resolve(); 
            },
            (error) => {
                reject(error);
            }
        );
    });
}

async function initCurrentLocation(){
    await getCurrentCoordinates();

    const data = await getLocationDetails(currentLocation.coordinates.latitude, currentLocation.coordinates.longitude);

    if(data){
        currentLocation.name = data.address?.city ?? ' - ';
        currentLocation.country = data.address?.country ?? ' - ';
    }
}

function setupEvents() {
    //event delegation -> attach event to parent
    document.body.addEventListener("click", async (e) => {
        const target = e.target as Element; 

        if (target.matches("#units-btn") || target.closest('#units-btn') ||
            target.matches("#switch_to_imperial_container") || target.closest('#switch_to_imperial_container')) {
            toggleUnitsOptionContainer();            
        } else if (target.matches("#week_days_btn") || target.closest('#week_days_btn')) {
            toggleDaysOptionContainer();            
        } else {
            closeFloatingContainers(); //check if theres no weird stuff happening with this!!!!
        }

        if(target.matches("#switch_to_imperial_container") || target.closest('#switch_to_imperial_container')) {
            if(isMetricUnits(unitsDict))
                unitsDict = { ...imperialUnits }; 
            else
                unitsDict =  { ...metricUnits }; 

            updateUnitsOnLocalStorage();

            getForecast();
        }

        if (target.matches("#retry_btn") || target.closest('#retry_btn')) {
            hideErrorContainer();
            await getForecast();      
        }

        const dayOptionEl = target.closest(".days-options-container .option");
        if (dayOptionEl) {
            clearSelectedFromDaysOptions();
            dayOptionEl.classList.add("selected");
            let selectedDateString = dayOptionEl.getAttribute('data-date') ?? '';
            selectedDate = new Date(selectedDateString);

            renderHourlyForecast(selectedDateString); //decided to pass the string to filter the array better
        }

        const optionEl = target.closest(".units-options-container .option");
        if (optionEl) {

            let unitKey = optionEl.getAttribute("data-unit");
            let value = optionEl.getAttribute("data-value")

            if(unitKey && value){
                unitsDict[unitKey as keyof UnitsDict] = value;
                localStorage.setItem(unitKey, value);
            }

            clearSelectedFromUnitOptions(unitKey ?? '');
            optionEl.classList.add('selected');
            renderUnitsOptionsContainer();
            await getForecast();
        }

        if(target.matches('#search-location-btn')){            
            const searchInput = document.getElementById('search-location-input') as HTMLInputElement; 
            if(searchInput){                 
                renderLocations(searchInput.value);
            }
        }
        
        let locationOption = target.closest('#location');
        if(locationOption){
            currentLocation.coordinates.longitude = locationOption.getAttribute('data-longitude') ?? '';
            currentLocation.coordinates.latitude = locationOption.getAttribute('data-latitude') ?? '';
            currentLocation.name = locationOption.getAttribute('data-name') ?? '';
            currentLocation.country = locationOption.getAttribute('data-country') ?? '';
            //update the input with the searched location??
            //get forecast data and render??
            getForecast();
        }
    });
}

async function renderLocations(search:string){
    let locationsContainer = document.getElementById('locations_container');
    if(!locationsContainer) return;

    let htmlLoading = `
        <div class="location flex">
            <img src="assets/images/icon-loading.svg" class="spinning" alt="loading icon">
            <span>Search in progress</span>
        </div>`;
    if(locationsContainer){
        locationsContainer.classList.remove('hidden');    
        locationsContainer.innerHTML = htmlLoading;
    }

    let locations: location[] = await searchLocations(search);

    if(locations.length < 1){
        locationsContainer.classList.add('hidden');
        renderLocationNotFoundContainer();
    }
    else {
        hideLocationNotFoundContainer();
    }


    let html = '';
    locations.forEach((location) => {
        html += `
            <div class="location" id="location" 
            data-name="${location.name}" data-country="${location.country}"
            data-longitude="${location.coordinates.longitude}" data-latitude="${location.coordinates.latitude}">
                <span class="">${location.name} (${location.country})</span>
            </div>
        `;
    });

    if(locationsContainer) {
        locationsContainer.innerHTML = html;    
    }
}

function getUnits() {
    (Object.keys(unitsDict) as (keyof UnitsDict)[]).forEach((key) => {
        console.log("key:", key);
        console.log("value:", localStorage.getItem(key));
        unitsDict[key] = localStorage.getItem(key) || unitsDict[key];
        console.log("dict value:", unitsDict[key]);
    });

}

function clearSelectedFromUnitOptions(unit:string = ''){ //clears all or by unit
    let selector = `.units-options-container .option`;
    selector += unit ? `[data-unit="${unit}"]` : '';

    let options = document.querySelectorAll(selector);
    
    options.forEach((option) => {
        option.classList.remove('selected');
    });
}

function clearSelectedFromDaysOptions(){ //clears all or by unit
    let options = document.querySelectorAll('.days-options-container .option');
    
    options.forEach((option) => {
        option.classList.remove('selected');
    });
}

function closeFloatingContainers(){
    const floatingContainers = document.querySelectorAll('.floating-container');
    floatingContainers.forEach((container) => {
        container.classList.add('hidden');
    });
}

function toggleUnitsOptionContainer(){
    const unitsContainer = document.getElementById('units-container');

    if(unitsContainer){
        unitsContainer.classList.toggle('hidden');
    } 
}

function toggleDaysOptionContainer(){
    const daysContainer = document.getElementById('days_container');

    if(daysContainer){
        daysContainer.classList.toggle('hidden');
    } 
}


function renderUnitsOptionsContainer(){
        getUnits();

        document.getElementById('units-container')?.remove(); //restart container

        const html = `
        <div class="units-container floating-container light-border hidden" id="units-container">
            <div class="switch-to-imperial-container" id="switch_to_imperial_container">
            <p>Switch to <span>${ isMetricUnits(unitsDict) ? "imperial" : "metric" }</span></p>
            </div>
            <div class="units-options-container">
            <div class="title">
                <span>Temperature</span>
            </div>
            <div class="option ${ unitsDict.temperature == "celsius" ? "selected" : "" }" data-unit="temperature" data-value="celsius">
                <span>Celsius (ºC)</span>
                <span class="checkmark-icon"><img src="assets/images/icon-checkmark.svg" alt="checkmark-icon"></span>
            </div>
            <div class="option ${ unitsDict.temperature == "fahrenheit" ? "selected" : "" }" data-unit="temperature" data-value="fahrenheit">
                <span>Fahrenheit (ºF)</span>
                <span class="checkmark-icon"><img src="assets/images/icon-checkmark.svg" alt="checkmark-icon"></span>
            </div>
            </div>
            <div class="units-options-container">
            <div class="title">
                <span>Wind speed</span>
            </div>
            <div class="option ${ unitsDict.wind_speed == "kmh" ? "selected" : "" }" data-unit="wind_speed" data-value="kmh">
                <span>km/h</span>
                <span class="checkmark-icon"><img src="assets/images/icon-checkmark.svg" alt="checkmark-icon"></span>
            </div>
            <div class="option ${ unitsDict.wind_speed == "mph" ? "selected" : "" }" data-unit="wind_speed" data-value="mph">
                <span>mph</span>
                <span class="checkmark-icon"><img src="assets/images/icon-checkmark.svg" alt="checkmark-icon"></span>
            </div>
            </div>
            <div class="units-options-container">
            <div class="title">
                <span>Precipitation</span>
            </div>
            <div class="option ${ unitsDict.precipitation == "mm" ? "selected" : "" }" data-unit="precipitation" data-value="mm">
                <span>Millimeters (mm)</span>
                <span class="checkmark-icon"><img src="assets/images/icon-checkmark.svg" alt="checkmark-icon"></span>
            </div>
            <div class="option ${ unitsDict.precipitation == "inch" ? "selected" : "" }" data-unit="precipitation" data-value="inch">
                <span>Inches (in)</span>
                <span class="checkmark-icon"><img src="assets/images/icon-checkmark.svg" alt="checkmark-icon"></span>
            </div>
            </div>
        </div>
    `;

    const nav = document.getElementById('nav');
    if(nav)
        nav.innerHTML += html;
}

function initLocationOptionsContainer(){
    const html = `
        <div class="locations-container floating-container hidden" id="locations_container">
        </div>
    `
    const container = document.getElementById('text_input_container');
    if(container) 
        container.innerHTML += html;            
}

function hideErrorContainer(){
    document.getElementById('weather_parent_container')?.classList.remove('hidden');

    const errorContainer = document.getElementById('error_container');
    if(errorContainer){
        errorContainer.classList.add('hidden');
    }
}

function renderErrorContainer(){
    document.getElementById('weather_parent_container')?.classList.add('hidden');
    const errorContainer = document.getElementById('error_container')
    
    if(errorContainer){
        errorContainer.classList.remove('hidden');
    } else {        
        const html = ` 
        <div class="error-container" id="error_container">
            <img class="error-icon" src="assets/images/icon-error.svg" alt="error-icon">
            <h1>Something went wrong</h1>
            <span>We couldn't connect you to the server (API error). Please try again in a few moments.</span>
            <button class="btn" id="retry_btn">
                <span><img src="assets/images/icon-retry.svg" alt="retry-icon"></span>
                <span>Retry</span>
            </button>
        </div>`;

        if(mainContainer)         
            mainContainer.innerHTML += html        
    }
}
function hideLocationNotFoundContainer(){
    document.querySelector('#weather_parent_container .body')?.classList.remove('hidden');

    const notFoundContainer = document.getElementById('not_found_container');
    if(notFoundContainer){
        notFoundContainer.classList.add('hidden');
    }
}
function renderLocationNotFoundContainer(){
    document.querySelector('#weather_parent_container .body')?.classList.add('hidden');

    let weatherParentContainer = document.querySelector('#weather_parent_container');
    let notFoundContainer = document.getElementById('not_found_container');

    if(notFoundContainer){
        notFoundContainer.classList.remove('hidden');
    } else {        
        const html = ` 
            <div class="not-found-container" id="not_found_container">
                <h2>No Search results found!</h2>
            </div>`;

        if(weatherParentContainer)         
            weatherParentContainer.innerHTML += html        
    }
}

//api client
async function searchLocations(location: string, lang: string = 'en', count:number = 10): Promise<location[]>{
    try {
        const url = `${base_geocoding_api_url}search?name=${location}&language=${lang}&count=${count}&format=json`        
        const res = await fetch(url);
        if(!res.ok){
            throw new Error(`HTTP error! Status: ${res.status}`);
        }

        const data = await res.json();

        const locations: location[] = Array.isArray(data.results) 
            ? data.results.map((item: any) => ({
                name: item.name ?? "Unknown",
                country: item.country,
                timezone: item.timezone,
                coordinates: {
                    latitude: item.latitude ?? 0,
                    longitude: item.longitude ?? 0
                }
            }))
            : [];                    

        return locations;
    } catch(error) {
        console.error("Error fetching geocoding data:", error);
        renderErrorContainer();
        return [];
    }
}

async function getForecast(){
    try {
        selectedDate = new Date();
        let url = `${base_openMeteo_api_url}forecast?latitude=${currentLocation.coordinates.latitude}&longitude=${currentLocation.coordinates.longitude}&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,weather_code&temperature_unit=${unitsDict.temperature}&wind_speed_unit=${unitsDict.wind_speed}&precipitation_unit=${unitsDict.precipitation}`;
        url += `&current=weather_code,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min`;        

        const res = await fetch(url);
        if(!res.ok){
            throw new Error(`HTTP error! Status: ${res.status}`);
        }

        const data = await res.json();
        hourlyForecast = data.hourly;
        
        renderCurrentWeatherCard(data.current.weather_code, data.current.temperature_2m);
        renderForecastDetails(data.current.temperature_2m, data.current.wind_speed_10m, data.current.precipitation);
        renderDailyForecast(data.daily);        
        renderDayOptions(data.daily.time);
        renderHourlyForecast(new Date().toISOString().split("T")[0]);
        console.log("Forecast", data);
    } catch(error) {
        console.error("Error fetching geocoding data:", error);
        renderErrorContainer();
    }
}

async function getLocationDetails(latitude: string = "", longitude:string = ""){
    try {
        let url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${ latitude ?? currentLocation.coordinates.latitude }&lon=${ longitude ?? currentLocation.coordinates.longitude }`;
        const res = await fetch(url);
        if(!res.ok){
            throw new Error(`HTTP error! Status: ${res.status}`);
        }

        const data = await res.json();

        return data;
        
    } catch(error) {
        console.error("Error fetching geocoding data:", error);
        renderErrorContainer();
    }
}

function renderCurrentWeatherCard(weatherCode:number = 9999, temperature:string = "", date: Date = new Date()){
    document.getElementById('current_forecast')?.classList.remove('loading');

    const currentLocationEl = document.getElementById('current_location') as HTMLElement;
    const currentDateEl = document.getElementById('current_date') as HTMLElement;
    const currentForecastIcon = document.getElementById('current_forecast_icon') as HTMLImageElement;
    const currentTemperature = document.getElementById('current_temperature') as HTMLElement;

    if (!currentLocationEl || !currentDateEl || !currentForecastIcon || !currentTemperature) return;

    currentLocationEl.innerHTML = `${currentLocation.name}, ${currentLocation.country}`;
    currentDateEl.innerHTML = getFullDate(date);
    currentForecastIcon.src = getForecastIconUrl(weatherCode);
    currentTemperature.innerHTML = `${temperature} º`;    
}

function renderForecastDetails(temperature:string = "", windSpeed:string = "", precipitation:string = ""){
    document.getElementById('current_forecast_details')?.classList.remove('loading');

    const temperatureEl = document.getElementById('forecast_details_temperature') as HTMLElement;
    const windSpeedEl = document.getElementById('forecast_details_wind_speed') as HTMLElement;
    const precipitationEl = document.getElementById('forecast_details_precipitation') as HTMLElement;

    if (!temperatureEl || !windSpeedEl || !precipitationEl) return;

    temperatureEl.innerHTML = `${temperature ?? '-'} º`;  
    windSpeedEl.innerHTML = `${windSpeed ?? '-'} ${unitsDict.wind_speed}`;  
    precipitationEl.innerHTML = `${precipitation ?? '-'} ${unitsDict.precipitation}`;  
}

function renderDailyForecast(dailyData:any){
    document.getElementById('daily_forecast')?.classList.remove('loading');

    let dailyForecastContainers = document.querySelectorAll(`.daily_forecast .body .forecast-card`);
    dailyForecastContainers.forEach((container) => {
    let containerIndex:number = Number(container.getAttribute('data-index'));

        let html = `
            <h5 class="title">${getWeekday(dailyData.time[containerIndex], true)}</h5>
            <img class="forecast-icon" src="${ getForecastIconUrl(dailyData.weather_code[containerIndex]) }" alt="forecast-icon">
            <div id="daily_temperature_range_container"  class="temperature-range-container">
                <span id="max_daily_temperature">${ dailyData.temperature_2m_max[containerIndex] }º</span>
                <span id="min_daily_temperature">${ dailyData.temperature_2m_min[containerIndex] }º</span>
            </div>
        `;

        container.innerHTML = html;
    })
}

function renderDayOptions(weekdays:any){
    const daysOptionsContainer = document.getElementById('days_options_container')  as HTMLElement;
    if(!daysOptionsContainer) return;

    let html = '';
    weekdays.forEach((date:string) =>{
        html += `
            <div class="option day-option ${getWeekday(selectedDate) == getWeekday(date) ? "selected": ""}" 
            data-date="${ date }"
           >
                <span>${ getWeekday(date, false)}</span>
            </div>
        `
    });
    daysOptionsContainer.innerHTML = html;    

    let selectedDayEl = document.getElementById('selected_day') as HTMLElement;
    selectedDayEl.innerHTML = getWeekday(selectedDate, false);
}

function renderHourlyForecast(date:Date | string = selectedDate){
      if(typeof(date) === 'string')
        date = new Date(date).toISOString().split("T")[0]; //correct format

    let selectedDayEl = document.getElementById('selected_day') as HTMLElement;
    
    let currentDateHour = new Date(new Date().setHours(new Date().getHours(), 0, 0, 0));

    document.getElementById('hourly_forecast')?.classList.remove('loading');
    const hourlyForecastBody = document.querySelector(".hourly_forecast .body") as HTMLElement;

    if(!selectedDayEl || !hourlyForecastBody) return;
    selectedDayEl.innerHTML = getWeekday(date, false);

    let html = "";
    
    hourlyForecast.time.forEach((dateHour:string, i: number) => {
      
        if(dateHour.includes(String(date)) && !(currentDateHour > new Date(dateHour))){
            html += `
                <div class="item">
                    <div class="hour_icon">
                    <img class="forecast-icon" src="${ getForecastIconUrl(hourlyForecast.weather_code[i]) }" alt="forecast-icon">
                    <span>${ getHour(hourlyForecast.time[i]) }</span>
                </div>
                <span>${ hourlyForecast.temperature_2m[i] }º</span>
                </div>
            `;
        }
    });

    hourlyForecastBody.innerHTML = html;
}

function getHour(date: Date | string): string {
  if(typeof(date) === 'string')
    date = new Date(date);

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",   
    hour12: true  
  });
}

function getFullDate(date: Date | string): string {
  if(typeof(date) === 'string')
    date = new Date(date);

  return date.toLocaleDateString("en-US", {
    weekday: "long", 
    month: "short",  
    day: "numeric",  
    year: "numeric", 
  });
}

function getWeekday(date: Date | string, getShortName = false): string {
    if(typeof(date) === 'string')
        date = new Date(date);

    return date.toLocaleDateString("en-US", { weekday: getShortName ? "short" : "long" });
}

function getForecastIconUrl(weatherCode:number){
    if(weatherCode == null)
        weatherCode = 9999;

    switch (weatherCode) {
        case 0:
        case 1:
        case 2:
        case 3:
            return `assets/images/icon-sunny.webp`;
        case 45:
        case 48:
            return `assets/images/icon-fog.webp`;
        case 51:
        case 53:                        
        case 55:   
        case 56:   
        case 57:  
            return `assets/images/icon-drizzle.webp`;
        case 61:                        
        case 63:   
        case 65:   
        case 66:                
        case 67:       
        case 80:   
        case 81:                
        case 82:                     
            return `assets/images/icon-rain.webp`;
        case 71:                        
        case 72:   
        case 73:   
        case 75:                
        case 77:    
        case 85:             
        case 86:                         
            return `assets/images/icon-snow.webp`;
        case 95:                         
            return `assets/images/icon-storm.webp`;
        default:
            return "assets/images/icon-error.svg";
    }
}

init();

interface UnitsDict {
  temperature: string;
  wind_speed: string;
  precipitation: string;
}

interface location {
    name:string,
    country:string,
    timezone:string | null,
    coordinates:coordinates
}

interface coordinates {
    latitude:string;
    longitude:string;
}

interface day { //not sure if i really need this....
    date: Date;
    dateNameFull: string;
    weekNameShort: string;
    weekNameLong: string;
}

// interface SimpleForecast{
//     date: Date;
//     temperature:string;
//     weatherCode:string;
// }