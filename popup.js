let apiDomainDefault =
  "api.segment.io,cdn.dreamdata.cloud,track.attributionapp.com,seg-api.usebounce.com,seg-api.bounce.com";

let connection = chrome.runtime.connect();

function showEvent(number) {
  document.getElementById("eventContent_" + number).style.display = "block";
}

function printVariable(jsonObject, level) {
  let returnString = "";
  for (let key in jsonObject) {
    if (jsonObject.hasOwnProperty(key)) {
      returnString += `<div style="padding-left: ${level * 10}px;">`;
      returnString += `<span class="key">${key}</span>`;

      if (typeof jsonObject[key] === "object") {
        returnString += ` {${printVariable(jsonObject[key], level + 1)}}`;
      } else {
        let type = isNaN(jsonObject[key]) ? "string" : "number";
        returnString += `: <span class="${type}">${jsonObject[key]}</span>`;
      }
      returnString += `</div>`;
    }
  }
  return returnString;
}

function queryForUpdate() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];

    connection.postMessage({
      type: "update",
      tabId: currentTab.id,
    });
  });
}

function clearTabLog() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];

    connection.postMessage({
      type: "clear",
      tabId: currentTab.id,
    });
  });
}

queryForUpdate();

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type == "new_event") {
    queryForUpdate();
  }
});

connection.onMessage.addListener((msg) => {
  if (msg.type == "update") {
    let prettyEventsString = "";
    let anonymousId = "";
    let userId = "";

    if (msg.events.length > 0) {
      for (var i = 0; i < msg.events.length; i++) {
        const event = msg.events[i];

        const jsonObject = JSON.parse(event.raw);
        let eventString = "";
        const url = new URL(event.hostName);
        const eventName = event.eventName;
        const pathname = url.pathname;
        const trackedTime = event.trackedTime;
        const isExposure = eventName === "$exposure";
        const eventType = isExposure ? "exposure" : event.type;

        let extra = "";
        if (isExposure) {
          const props = jsonObject.properties;
          const flagKey = props?.flag_key;
          const variant = props?.variant;

          extra = `<div class="eventHeader_extra"><span class="flagKey">${flagKey}</span> - ${variant}</div>`;
        }

        const isNewAnonymousId = jsonObject.anonymousId !== anonymousId;
        const isNewUserId = jsonObject.userId !== userId;
        if (isNewAnonymousId || isNewUserId) {
          anonymousId = jsonObject.anonymousId;
          userId = jsonObject.userId;

          extra += `<div class="eventHeader_extra"><span class="newAnonymousId"><span class="newValue">anonymousId</span>: ${anonymousId}</span></div>`;
          extra += `<div class="eventHeader_extra"><span class="newUserId"><span class="newValue">userId</span>: ${userId}</span></div>`;
        }

        eventString += `<div class="eventTracked eventType_${eventType}" data-event-type="${eventType}">
					<div class="eventInfo">
					  <div class="eventHeader" id="eventInfo_${i}"  >
								<div class="eventHeader_title"><span class="eventName">${eventName}</span> - ${pathname} - ${trackedTime}</div>
                ${extra}
						</div>
						<div class="eventContent" id="eventContent_${i}">
							${printVariable(jsonObject, 0)}
						</div>
					</div>
				</div>`;

        prettyEventsString += eventString;
      }
    } else {
      prettyEventsString += "No events tracked in this tab yet.";
    }
    document.getElementById("trackMessages").innerHTML = prettyEventsString;

    for (var i = 0; i < msg.events.length; i++) {
      const number = i;
      document.getElementById("eventInfo_" + number).onclick = function () {
        if (
          document.getElementById("eventContent_" + number).style.display ==
          "flex"
        ) {
          document.getElementById("eventContent_" + number).style.display =
            "none";
        } else {
          document.getElementById("eventContent_" + number).style.display =
            "flex";
        }
      };
    }
  }
});

function filterEvents(keyPressedEvent) {
  let filterValue = document.getElementById("filterInput").value;
  if (keyPressedEvent?.target?.value) {
    filterValue = keyPressedEvent.target.value;
  }

  const filter = new RegExp(filterValue, "gi");
  const eventElements = document
    .getElementById("trackMessages")
    .getElementsByClassName("eventTracked");

  const typeFilters = {
    track: !!document.getElementById("track").checked,
    identify: !!document.getElementById("identify").checked,
    pageLoad: !!document.getElementById("pageLoad").checked,
    exposure: !!document.getElementById("exposure").checked,
  };

  for (eventElement of eventElements) {
    const eventType = eventElement.dataset.eventType;

    const eventName =
      eventElement.getElementsByClassName("eventName")[0].textContent;
    const flagKey =
      eventElement.getElementsByClassName("flagKey")[0]?.textContent;

    const isInTypeFilter =
      typeFilters[eventType] === undefined || typeFilters[eventType];

    const isInSearchFilter =
      filterValue === "" ||
      eventName.match(filter) ||
      (!!flagKey && flagKey.match(filter));

    if (isInSearchFilter && isInTypeFilter) {
      eventElement.classList.remove("hidden");
    } else {
      eventElement.classList.add("hidden");
    }
  }
}

function toggleConfiguration() {
  const configurationDiv = document.getElementById("configurationTab");
  const eventsDiv = document.getElementById("eventsTab");
  const headerActionsDiv = document.getElementById("headerActions");

  configurationDiv.hidden = false;
  eventsDiv.hidden = true;
  headerActionsDiv.className = "active_configureButton";
}

function toggleEvents() {
  const configurationDiv = document.getElementById("configurationTab");
  const eventsDiv = document.getElementById("eventsTab");
  const headerActionsDiv = document.getElementById("headerActions");

  configurationDiv.hidden = true;
  eventsDiv.hidden = false;
  headerActionsDiv.className = "active_eventsButton";
}

function updateApiDomain(apiDomain) {
  chrome.storage.local.set(
    { segment_api_domain: apiDomain || apiDomainDefault },
    function () {}
  );
}

function handleApiDomainUpdates() {
  const apiDomainInput = document.getElementById("apiDomain");

  chrome.storage.local.get(["segment_api_domain"], function (result) {
    apiDomainInput.value = result.segment_api_domain || apiDomainDefault;
    apiDomainInput.onchange = () => updateApiDomain(apiDomainInput.value);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  const clearButton = document.getElementById("clearButton");
  clearButton.onclick = clearTabLog;

  const filterInput = document.getElementById("filterInput");
  filterInput.onkeyup = filterEvents;
  filterInput.focus();

  const trackFilter = document.getElementById("track");
  trackFilter.onchange = () => filterEvents();

  const identifyFilter = document.getElementById("identify");
  identifyFilter.onchange = () => filterEvents();

  const pageFilter = document.getElementById("pageLoad");
  pageFilter.onchange = () => filterEvents();

  const exposureFilter = document.getElementById("exposure");
  exposureFilter.onchange = () => filterEvents();

  const configureButton = document.getElementById("configureButton");
  configureButton.onclick = toggleConfiguration;

  const eventsButton = document.getElementById("eventsButton");
  eventsButton.onclick = toggleEvents;

  handleApiDomainUpdates();
});
