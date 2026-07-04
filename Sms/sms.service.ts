// backend/utils/sms.service.ts
import axios from 'axios';

// It's best practice to use environment variables, but I've left your defaults here as fallbacks
const BASE_URL = 'http://192.168.0.105:8080';
const USERNAME = 'sms';
const PASSWORD = 'SivgsxdL';

/**
 * Sends an SMS message to a specific phone number using the local SMS gateway.
 * * @param phoneNumber The 10-digit mobile number (string)
 * @param message The text message content
 * @returns A boolean indicating success (true) or failure (false)
 */
export async function sendSms(phoneNumber: string, message: string): Promise<boolean> {
    // Guard clause to prevent sending if phone number is missing
    if (!phoneNumber) {
        console.warn('⚠️ SMS Skipped: No phone number provided.');
        return false;
    }

    const url = `${BASE_URL}/messages`;

    const payload = {
        textMessage: {
            text: message
        },
        // The server expects an array of phone numbers
        phoneNumbers: [phoneNumber]
    };

    try {
        const response = await axios.post(url, payload, {
            auth: { username: USERNAME, password: PASSWORD },
            headers: { 'Content-Type': 'application/json' },
        });

        console.log(`✅ SMS Enqueued Successfully for ${phoneNumber}`);
        return true;

    } catch (error: any) {
        console.error(`❌ Failed to send SMS to ${phoneNumber}.`);

        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data:`, JSON.stringify(error.response.data));
        } else {
            console.error(error.message);
        }

        // Returning false allows the caller to handle the failure without crashing the server
        return false;
    }
}