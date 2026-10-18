const response = await fetch(
  "http://localhost:3000/health",
  {
    method: "GET",
    headers: {
      "x-api-key": "1243"
    }
  }
);

const data = await response.json();

console.log(response.status);
console.log(data);