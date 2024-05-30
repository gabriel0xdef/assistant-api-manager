import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export const functionName = "extractDishesFromWebsite";

export const functionOptions = {
    type: "function",
    function: {
        name: functionName,
        description: "This function extracts all dish descriptions, details, and prices from a website using a given URL passed as a parameter. It employs puppeteer-extra for stealth browsing and specifies a Mozilla user-agent for web scraping.",
        parameters: {
            type: "object",
            properties: {
                "url":{
                    "type":"string",
                    "description":"The URL of the website to scrape the dishes information from."
                 }
            },
            required: ["url"]
        }
    }
};

export const extractDishesFromWebsite = async function (param) {
    const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:88.0) Gecko/20100101 Firefox/88.0'});
    const page = await browser.newPage();
    await page.goto(param.url);
    const dishes = await page.evaluate(() => {
        const dishes = [];
        document.querySelectorAll('.dish-card-wrapper').forEach(dish => {
            const description = dish.querySelector('.dish-card__description').innerText;
            const details = dish.querySelector('.dish-card__details').innerText;
            const price = dish.querySelector('.dish-card__price').innerText;
            dishes.push(`${description}\n${details}\n${price}`);
        });
        return dishes.join('\n\n');
    });
    await browser.close();
    return dishes;
};