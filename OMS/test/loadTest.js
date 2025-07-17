const axios = require("axios");

const users = Array.from({ length: 100 }, (_, i) => ({
  username: `user${i + 1}`,
  password: i % 10 === 0 ? "1234" : "wrongpassword",
}));

async function sendLoginRequest(user) {
  try {
    const response = await axios.post("http://localhost:5000/api/login", user);
    console.log(`User: ${user.username}, Success: ${response.data.success}`);
  } catch (error) {
    console.error(`User: ${user.username}, Error: ${error.response?.data.message}`);
  }
}

async function runLoadTest() {
  console.log("Starting load test...");
  for (const user of users) {
    await sendLoginRequest(user); // 한 번에 하나의 요청만 처리
  }
  console.log("Load test completed.");
}

runLoadTest();
