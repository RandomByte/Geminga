Geminga
=======

# Installation
1. Clone this repository
2. Run '$ npm install' to install all dependencies
3. Copy config.example.json to config.json and fill it with your data (see chapter "Configuration")
4. Run geminga.js! For example using [supervisor](https://github.com/isaacs/node-supervisor) '$ supervisor -q geminga.js >> /var/log/geminga.log'

# Remote nodes
See [Geminga-Remote](https://github.com/RandomByte/Geminga-Remote)

Only needed to execute actions on the remote node (not for Wake-on-Lan or simple online/offline check using a ping)

# Configuration

- **Port:** The port the web interface should run on
- **Password:** The password protecting the web interface
- **Cookie- and Session Secrets:** Enter some random strings (including special characters) to ensure all cookies are properly signed and encrypted
- **Resources** (can be PCs, servers, arduinos, whatever is connected to a network...)
  - **Name and ID:** To identify the resource in the web interface
  - **IP or Hostname:** IP will always overrule hostname. Typically you specify one *or* the other
  - **MAC-Address:** Used for Wake-on-Lan
  - **Location:** Will be displayed in the web interface
  - **Actions:** All the actions supported for the remote node
  - **Token:** The token to be used for communication with the remote node. Every remote node can generate a token itself by running '$node geminga-remote.js token'. Just copy the output in your config here.

### This is the example configuration you can find in config.example.json:
```
{
    "port": 3000,
    "password": "The password I have to remember",
    "cookieSecret": "My little secret",
    "sessionSecret": "My other secret",
    "resources": [
        {
            "name": "My beloved server",
            "id": "beloved-server",
            "ip": "123.213.231.121",
            "hostname": "example.com", // alternative to ip
            "mac": "12:ab:34:cd:56:ef",
            "location": "In the clouds",
            "actions": ["wake", "shutdown", "vpn-start", "vpn-stop"], // all the actions the remote supports
            "token": "<get this from your geminga remote node>" // to ensure trust between server and remote node
        }
    ]
}
```
