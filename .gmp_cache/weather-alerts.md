# Return Weather Alerts in Real Time

The `publicAlerts:lookup` endpoint of the Google Maps Platform Weather API
returns active, real-time weather event alerts issued by authoritative national
and international agencies for a specified latitude and longitude.

## Endpoint Details

-   **URL:** `https://weather.googleapis.com/v1/publicAlerts:lookup`
-   **Method:** `GET`
-   **Required Headers:**
    -   `X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1`

### Query Parameters

Parameter            | Type     | Required     | Description
:------------------- | :------- | :----------- | :----------
`key`                | `string` | **Required** | Your Google Maps Platform API key.
`location.latitude`  | `number` | **Required** | The latitude coordinate of the target location.
`location.longitude` | `number` | **Required** | The longitude coordinate of the target location.
`languageCode`       | `string` | Optional     | The BCP-47 language code for translating the `alertTitle`. Defaults to English (`en`) if omitted or unsupported.

> **Important Note on Translations:** Only the `alertTitle` field is translated
> by Google when `languageCode` is specified. Because alert payloads are served
> as-is from partner agencies, fields such as `description`, `instruction`, and
> `safetyRecommendations` are returned in the original language published by the
> issuing agency.

--------------------------------------------------------------------------------

## Code Examples

### cURL Request

```bash
curl -X GET "https://weather.googleapis.com/v1/publicAlerts:lookup?key=YOUR_API_KEY&location.latitude=35.824635&location.longitude=-78.3168047&languageCode=en" \
  -H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1"
```

### JavaScript (`fetch`)

```javascript
async function getWeatherAlerts(latitude, longitude, apiKey, languageCode = 'en') {
  const url = new URL('https://weather.googleapis.com/v1/publicAlerts:lookup');
  url.searchParams.append('key', apiKey);
  url.searchParams.append('location.latitude', latitude);
  url.searchParams.append('location.longitude', longitude);
  url.searchParams.append('languageCode', languageCode);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1'
    }
  });

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}
```

--------------------------------------------------------------------------------

## Response Schema & Handling

### Handling No Active Alerts

If there are no active weather alerts in the requested location (or if a
required field from the original provider is missing), the `weatherAlerts` array
is omitted and the response body only contains the `regionCode`:

```json
{
  "regionCode": "US"
}
```

### Active Alert Response Example

```json
{
  "weatherAlerts": [
    {
      "alertId": "urn:oid:2.49.0.1.840.0.2416b1b5a6f51d29ef4b94948328dca303fbbb5c.001.1",
      "alertTitle": {
        "text": "Flash Flood Warning",
        "languageCode": "en"
      },
      "eventType": "FLASH_FLOOD",
      "areaName": "Franklin, NC; Johnston, NC; Nash, NC; Wake, NC",
      "polygon": "{\"type\":\"Polygon\",\"coordinates\":[[[-78.450000,35.820000],[-78.410000,35.730000],[-78.280000,35.660000],[-78.450000,35.820000]]]}",
      "description": "The National Weather Service in Raleigh has issued a Flash Flood Warning...",
      "severity": "SEVERE",
      "certainty": "LIKELY",
      "urgency": "IMMEDIATE",
      "instruction": [
        "Turn around, don't drown when encountering flooded roads. Most flood deaths occur in vehicles."
      ],
      "safetyRecommendations": [
        {
          "directive": "Be aware that flash flooding can occur.",
          "subtext": "If there is any possibility of a flash flood, move immediately to higher ground."
        }
      ],
      "timezoneOffset": "-14400s",
      "startTime": "2025-08-06T18:24:00Z",
      "expirationTime": "2025-08-06T21:30:00Z",
      "dataSource": {
        "publisher": "NOAA",
        "name": "National Weather Service",
        "authorityUri": "https://www.weather.gov/"
      }
    }
  ],
  "regionCode": "US"
}
```

### Response Fields Reference

Field                   | Type            | Required/Optional | Description
:---------------------- | :-------------- | :---------------- | :----------
`alertId`               | `String`        | Required          | Unique identifier for the alert from the provider.
`alertTitle`            | `Object`        | Required          | Contains `text` (title of the alert) and `languageCode`.
`eventType`             | `Enum`          | Required          | The weather event type (e.g., `FLASH_FLOOD`, `TORNADO_WARNING`, `WILDFIRE`, `HEAT`, `WINTER_STORM`).
`areaName`              | `String`        | Required          | Name of the geographic area affected by the alert.
`polygon`               | `String`        | Optional          | GeoJSON string defining the closed dimensional boundary of the alert.
`description`           | `String`        | Optional          | Detailed summary or raw text describing the event.
`severity`              | `Enum`          | Optional          | Threat level: `EXTREME`, `SEVERE`, `MODERATE`, `MINOR`, or `UNKNOWN`.
`certainty`             | `Enum`          | Optional          | Probability level: `OBSERVED`, `VERY_LIKELY`, `LIKELY`, `POSSIBLE`, `UNLIKELY`, or `UNKNOWN`.
`urgency`               | `Enum`          | Optional          | Timing requirement: `IMMEDIATE`, `EXPECTED`, `FUTURE`, `PAST`, or `UNKNOWN`.
`instruction`           | `Array<String>` | Optional          | Responsive action instructions for the target audience.
`safetyRecommendations` | `Array<Object>` | Optional          | Public authority directives containing `directive` and `subtext`.
`timezoneOffset`        | `String`        | Required          | Timezone offset of the event.
`startTime`             | `DateTime`      | Optional          | Effective UTC timestamp of the alert (ISO 8601).
`expirationTime`        | `DateTime`      | Optional          | Expected UTC end timestamp. May be null for indefinite events.
`dataSource`            | `Object`        | Required          | Authority details (`publisher`, `name`, and `authorityUri`).
`regionCode`            | `String`        | Optional          | Region code of the requested location.

--------------------------------------------------------------------------------

## Mandatory Source Attribution Requirements

When displaying weather alert data in a user interface, **you must display an
attribution to the original authority** using the `dataSource` object returned
in each alert:

1.  Display the full name of the agency (`dataSource.name`).
2.  Hyperlink the name directly to the agency's website
    (`dataSource.authorityUri`).

**Example HTML Attribution:**

```html
<p>Source: <a href="https://www.weather.gov/" target="_blank" rel="noopener noreferrer">National Weather Service</a></p>
```
