import "dotenv/config";
import net from "node:net";
import app from "./app.js";

const requestedPort = Number(process.env.PORT || 5001);

function getAvailablePort(port) {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();

    tester.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(getAvailablePort(port + 1));
        return;
      }

      reject(error);
    });

    tester.once("listening", () => {
      const address = tester.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      tester.close(() => resolve(actualPort));
    });

    tester.listen(port, "0.0.0.0");
  });
}

const port = await getAvailablePort(requestedPort);

app.listen(port);
