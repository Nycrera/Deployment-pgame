/* jshint node: true */
/*jshint esversion: 6 */
const {
  exec
} = require("child_process");
var request = require("request");
const fs = require("fs");
var CONFIG = JSON.parse(fs.readFileSync("config.json"));

var http = require("http");
var createHandler = require("github-webhook-handler");
var handler = createHandler({
  path: CONFIG.webHook.path,
  secret: CONFIG.webHook.Secret
});

http
  .createServer(function (req, res) {
    handler(req, res, function (err) {
      res.statusCode = 404;
      res.end("no such location");
    });
  })
  .listen(CONFIG.webHook.port);

handler.on("error", function (err) {
  console.error("Error:", err.message);
});

handler.on("push", function (event) {
      var now = Math.floor(Date.now() / 1000); // get time in seconds
      alertGameServer(
        CONFIG.gameServer.ip,
        CONFIG.gameServer.port,
        CONFIG.killTime,
        () => {
          const git = require('simple-git')(CONFIG.directory.repository);
          git.fetch(() => {
            git.pull(() => {
              // move files to their appropriate directories

              //exec('nohup python3 '+CONFIG.directory.gameServer+'main.py'); TODO: IS this actually works test pls ?
            });
          }); // after kill time passes game server will be killed forcefully.
          console.log(
            "Received a push event for %s to %s at time %d",
            event.payload.repository.name,
            event.payload.ref,
            now
          );
        });

      function alertGameServer(ip, port, killTime, callback) {
        if (DEBUG) console.log(`Sending Alert to GameServer on ${ip}:${port}`);
        var isAlive = true;
        if (CONFIG.sameServer) {
          // this means that both deployment server and game server is in the same host server which means we can kill it forcefully.
          setTimeout(() => {
            if (isAlive) {
              if (DEBUG)
                console.log("Game Server given no response and kill time ran out. Killing with force.");
              if (process.platform === "win32") {
                // For windows
                exec(`Stop-Process -Id (Get-NetTCPConnection -LocalPort ${port}).OwningProcess -Force`);
              } else {
                // Linux etc.
                exec(`lsof -i tcp:${port} | grep LISTEN | awk '{print $2}' | xargs kill -9`);
              }
            }
          }, killTime); // so basically this will find process that uses that port and then it's going to kill found proccess.
        }

        //This part will say shutdown to server and will wait for a proper response.
        request("http://" + ip + ":" + port + "/kill?time=now", function (error, response, body) {
          // TODO: DON'T FORGET! GAME SERVER SHOULD CHECK IF THIS IP HAS PERMISSION TO DO SO
          if (error) console.log(error);
          if (response && response.statusCode)
            // Server acknowledged and is now going to kill itself immediately.
            setTimeout(callback, 2000);
          if (DEBUG) console.log("Server Acknowledged the request.");
          isAlive = false; // No need to force kill anymore.
        });
      }