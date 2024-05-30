
import axios from 'axios';
import cheerio from 'cheerio';

export const functionName = "fetchLatestNvidiaNews";

export const functionOptions = {
    type: "function",
    function: {
        name: functionName,
        description: "This function fetches the latest news about Nvidia from an official source.",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    }
};

export const fetchLatestNvidiaNews = async function () {
    const sourceUrl = 'https://nvidianews.nvidia.com/';
const newsResponse = await axios.get(sourceUrl);
const $ = cheerio.load(newsResponse.data);
const newsItems = [];
$('.news-title').each((index, element) => {
  newsItems.push($(element).text().trim());
});
return newsItems;
};
