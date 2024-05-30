
import axios from 'axios';

export const functionName = "fetchBitcoinPrice";

export const functionOptions = {
    type: "function",
    function: {
        name: functionName,
        description: "This function fetches the current price of Bitcoin in USD.",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    }
};

export const fetchBitcoinPrice = async function () {
    const url = 'https://api.coindesk.com/v1/bpi/currentprice/BTC.json';
    const response = await axios.get(url);
    return `O valor atual do Bitcoin é $${response.data.bpi.USD.rate} dólares.`;
};
