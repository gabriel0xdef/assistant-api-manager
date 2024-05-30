export const functionName = "getDataAtual";

export const functionOptions = {
    type: "function",
    function: {
        name: functionName,
        description: "get Data Atual",
        parameters: {}
    }
};

export const getDataAtual = async function () {
    const date = new Date();
    return date.toString();
};

// funcao que cria funcoes
// addexternal dentro do código
// condicao para executar a funcao
// alterar instrucao do assistente

//Use axios and cheerio libraries to get the content of the website "https://terra.com.br" and get all the content of all class card-news__text, and extract from the tag h3 inside them, create a list  and then return these list as string  separated by line breaks for each information.
//Create a function using puppeteer and stealth and using mozilla user-agent  to extract all the news from a url passed as a parameter using the class selector dish-card-wrapper and inside of it extract the texts of the classes dish-card__description class and dish-card__details and dish-card__price, list all of them and return them as a string. Use puppeteer-extra instead of puppeteer library