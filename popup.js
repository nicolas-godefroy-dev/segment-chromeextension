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
    var currentTab = tabs[0];

    connection.postMessage({
      type: "update",
      tabId: currentTab.id,
    });
  });
}

function clearTabLog() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    var currentTab = tabs[0];

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
    var prettyEventsString = "";
    let anonymousId = "";
    let userId = "";

    if (msg.events.length > 0) {
      for (var i = 0; i < msg.events.length; i++) {
        var event = msg.events[i];

        var jsonObject = JSON.parse(event.raw);
        var eventString = "";
        const url = new URL(event.hostName);
        const eventName = event.eventName;
        const pathname = url.pathname;
        const trackedTime = event.trackedTime;
        const eventType = event.type;
        const isExposure = eventName === "$exposure";

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

        eventString += `<div class="eventTracked eventType_${eventType}">
					<div class="eventInfo">
					  <div class="eventHeader" id="eventInfo_${i}">
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
  var filter = new RegExp(keyPressedEvent.target.value, "gi");
  var eventElements = document
    .getElementById("trackMessages")
    .getElementsByClassName("eventTracked");
  for (eventElement of eventElements) {
    let eventName =
      eventElement.getElementsByClassName("eventName")[0].textContent;
    let flagKey =
      eventElement.getElementsByClassName("flagKey")[0]?.textContent;

    if (eventName.match(filter) || (!!flagKey && flagKey.match(filter))) {
      eventElement.classList.remove("hidden");
    } else {
      eventElement.classList.add("hidden");
    }
  }
}

function toggleConfiguration() {
  var configurationDiv = document.getElementById("configurationDiv");
  configurationDiv.hidden = !configurationDiv.hidden;

  var contentDiv = document.getElementById("contentDiv");
  contentDiv.hidden = !contentDiv.hidden;
}

function updateApiDomain(apiDomain) {
  chrome.storage.local.set(
    { segment_api_domain: apiDomain || apiDomainDefault },
    function () {}
  );
}

function handleApiDomainUpdates() {
  var apiDomainInput = document.getElementById("apiDomain");

  chrome.storage.local.get(["segment_api_domain"], function (result) {
    apiDomainInput.value = result.segment_api_domain || apiDomainDefault;
    apiDomainInput.onchange = () => updateApiDomain(apiDomainInput.value);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  var clearButton = document.getElementById("clearButton");
  clearButton.onclick = clearTabLog;

  var filterInput = document.getElementById("filterInput");
  filterInput.onkeyup = filterEvents;
  filterInput.focus();

  var configureButton = document.getElementById("configureButton");
  configureButton.onclick = toggleConfiguration;

  handleApiDomainUpdates();
});
