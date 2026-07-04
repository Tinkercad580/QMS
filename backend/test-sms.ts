import axios from 'axios';

const BASE_URL = 'http://192.168.0.105:8080'; 
const USERNAME = 'sms';
const PASSWORD = 'SivgsxdL';

async function sendTestSms(phoneNumber: string, message: string) {
  const url = `${BASE_URL}/messages`; 
  
  // Removed "deviceId" to allow the server to select the active device automatically
  const payload = {
    textMessage: {
      text: message
    },
    phoneNumbers: [phoneNumber]
  };

  try {
    const response = await axios.post(url, payload, {
      auth: { username: USERNAME, password: PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });

    console.log('✅ SMS Enqueued Successfully!');
    console.log('Response:', response.data);
  } catch (error: any) {
    console.error('❌ Failed to send SMS.');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

sendTestSms('8452045908', '....This is a test message from ClinicBase. Please ignore if received in error.').catch(e => console.error("Test SMS error:", e));