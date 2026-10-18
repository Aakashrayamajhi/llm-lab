const response = await fetch(
    "http://localhost:3000/ask-ai?prompt=what%20is%20your%20name",
  {
    method: "GET",
    headers: {
      "x-api-key": "123"
    },
  }
);

const data = await response.json();

console.log(response.status);
console.log(data);