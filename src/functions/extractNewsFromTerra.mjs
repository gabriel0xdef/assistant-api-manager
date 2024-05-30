
import axios from 'axios';
import cheerio from 'cheerio';

export const functionName = "extractNewsFromTerra";

export const functionOptions = {
    type: "function",
    function: {
        name: functionName,
        description: "This function extracts all news headlines from www.terra.com.br website using axios to fetch the HTML content and cheerio to parse it and extract the texts from elements with the selector '.card-news__text' and the 'h3' tag inside it. It then lists all of them and returns them as a string.",
        parameters: {
            type: "object",
            properties: {"url":{"type":"string","description":"The URL to fetch the news from."}},
            required: []
        }
    }
};

export const extractNewsFromTerra = async function (url) {
    const result = await axios.get('https://www.terra.com.br');
    const $ = cheerio.load(result.data);
    const newsItems = [];
    $('.card-news__text h3').each((index, element) => {
    newsItems.push($(element).text().trim());
    });
    return newsItems.join('\n');
};
