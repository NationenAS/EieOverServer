const CronJob = require("node-cron");
const w = require('../writeFromApi');
const slack = require('../slackalert.js')
const fs = require('fs');
const axios = require('axios')

exports.initScheduledJobs = async () => {

  const scheduledJobFunction = CronJob.schedule("0 */6 * * *", async () => {
    let now = new Date();

    //w.formatDate(Date.now());

    console.log("Node-Cron kjører " + now.toLocaleDateString() + " " + now.toLocaleTimeString());


    //dagens dato til riktig format yyyy-mm-dd
    let today = new Date();
    let toDate = today.toISOString().slice(0, 10);

    //60 dager siden riktig format yyyy-mm-dd
    let c = new Date();
    c.setDate(c.getDate() - 60);
    let fromDate = c.toISOString().slice(0, 10);

    let sales = await w.loadDataFromAmedia(fromDate, toDate);

    // Skriv til databasen
    //await Sales.insertMany(allSales);

    let salesJSON = JSON.stringify(sales);
    fs.writeFileSync('./public/sales.json', salesJSON);
    console.log("skriver til sales.json");
    sales = [];
    fs.appendFileSync('./writelog.txt', "\r\nHentet data fra server " + now + "   -  henter fra " + fromDate + " til " + toDate);
  });

  scheduledJobFunction.start();


  const cronArea = CronJob.schedule("0 7 * * *", async () => {
    console.log("Slack-Cron kjører " + new Date());

    let lastSaleDate = fs.readFileSync('./public/date.txt', 'utf8');

    let lastSaleDateTime = new Date(lastSaleDate).getTime();
    let text = "";

    try {
      let data = await w.getData("http://api.nationen.no/kart/sales.json");
      for (index = 0; index < data.length; index++) {
        if (index == 0) fs.writeFileSync('./public/date.txt', data[0].date);
        if (compareDates(new Date(data[index].date.toString()), lastSaleDateTime) == false) {
          console.log('Alle nye datoer sjekket');
          post(text);
          return;
        }

        if (data[index].price < 8000000) continue;

        let areas = 0;
        for (i = 0; i < data[index].prop.length; i++) {
          let area = await slack.checkOneArea(data[index].prop[i].matNumb);
          areas += area;
        }
        text += "Dato: " + data[index].date + "  til " + (data[index].price / 1000000) + " millioner kroner  med ID" + data[index].saleId + " med størrelse " + areas + " dekar \n";
      }

      async function post(text) {
        axios.post(`https://graph.workplace.com/group/feed?message=${text}&access_token=DQVJ0cmJTdWZAhTXNOdWV2SHdrSGZAONmp0MFVhOVpTb2V2U2c2U1RTRjFiX3BSTzhCWF8wZAW8yYk94cmNpM2pGdWlIT3k0c1JOTHBYc0wxV1lORy1YVjJGTi1LR1IwNXNvMGFjNXd1Y1B3MEtNT0tvWEd4MWhnUGlLN0w5N3FCOVRTaGduRXRISFdFei1KbFF3cTZAlckZARS0hCMUhzaEhqU0ZAFWDVMMEw5V3dYWWY3YXFjUkd4ajRJM3pVWlFYYW5HczV4dldn`).then(() => { console.log(`Melding sendt`) }).catch(() => { console.log('Melding feilet') })
      }

    } catch (error) {
      console.log(error);
    }
  });
  cronArea.start();
}

const compareDates = (d1, d2) => {
  if (d1 > d2) {
    return true
  } else {
    return false
  }
};
