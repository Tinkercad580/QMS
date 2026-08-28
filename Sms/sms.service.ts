// Sms/sms.service.ts
import axios from 'axios';

// Gateway settings come from the environment — see .env.example. They used to
// be hardcoded here, which put the gateway password into every clone of the
// repository and into its git history.
const BASE_URL = process.env.SMS_GATEWAY_URL || '';
const USERNAME = process.env.SMS_GATEWAY_USER || '';
const PASSWORD = process.env.SMS_GATEWAY_PASSWORD || '';

// Logged once at startup rather than on every send, so a missing configuration
// is obvious immediately instead of showing up as silent non-delivery.
const SMS_CONFIGURED = Boolean(BASE_URL && USERNAME && PASSWORD);
if (!SMS_CONFIGURED) {
    console.warn('⚠️  SMS gateway not configured (SMS_GATEWAY_URL / _USER / _PASSWORD) — messages will be skipped.');
}

/**
 * Sends an SMS message to a specific phone number using the local SMS gateway.
 * * @param phoneNumber The 10-digit mobile number (string)
 * @param message The text message content
 * @returns A boolean indicating success (true) or failure (false)
 */
export async function sendSms(phoneNumber: string, message: string): Promise<boolean> {
    // Nothing to send through — bail out before attempting a request that
    // would only fail after a timeout.
    if (!SMS_CONFIGURED) return false;
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