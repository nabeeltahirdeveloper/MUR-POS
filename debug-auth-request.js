
const fetch = require('node-fetch');

async function testAuth() {
    try {
        const response = await fetch('http://localhost:3000/api/debug-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: "ahmedwaleed9897@gmail.com",
                password: "Waliahmed123@4"
            })
        });

        const data = await response.json();
        console.log("Status:", response.status);
        console.log("Response:", JSON.stringify(data, null, 2));

    } catch (err) {
        console.error("Error:", err);
    }
}

testAuth();
