const axios = require('axios');
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
process.stdin.setEncoding("utf8");
const app = express();
app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended:false}));
require("dotenv").config({path: path.resolve(__dirname, '.env')}) ;
const portNumber = 5000;
app.engine('html', require('ejs').renderFile);

app.use(express.static("style")); 
app.use(express.static("templates"));

/* Username & password to access MongoDB (stored in .env) */
const userName = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;

 /* Our database and collection */
 const databaseAndCollection = {db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION};

const { MongoClient, ServerApiVersion } = require('mongodb');
const { request } = require("http");
const uri = `mongodb+srv://${userName}:${password}@cluster0.ec6cayr.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1 });

app.listen(portNumber);
console.log(`Web server started and running at http://localhost:${portNumber}`);

/*onload renders index*/
app.get("/", (request, response) => {
    response.render("index");
});

/* when user clicks on add recipe */
app.get("/addRecipe", (request, response) => {
    response.render("addRecipe");
});

/*when user clicks get recipe information*/
app.get("/recipeInfo", async (request,response) => {

    /*Accessing database*/
    try {
        await client.connect();
        let filter = {};
        const cursor = await client.db(databaseAndCollection.db)
                        .collection(databaseAndCollection.collection)
                        .find(filter);
        const result = await cursor.toArray();

        /*Creation of the recipeTable*/
        var recipeTable = "<table class = 'ingr'><tr><th><strong>Recipe</strong></th><th><strong>Calories Per Serving</strong></th></tr>";
        result.forEach(element => {
            recipeTable += `<tr><td>${element.recipeName}</td><td>${Number(element.caloriesPerServ).toFixed(2)}</td></tr>`;
        });
        recipeTable += "</table>";

        const variables = {
            recipeTable: recipeTable,
        };

        response.render("recipeInfo", variables);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
});

/*When user clicks the submit button for get recipe information*/
app.post("/recipeInfo", async (request, response) => {

    try {
        await client.connect();
        /*filtering by the recipe name*/
        let filter = {recipeName: request.body.recipeName};
        const result = await client.db(databaseAndCollection.db)
                        .collection(databaseAndCollection.collection)
                        .findOne(filter);

        let currIngr = 0;

        /*creation of the ingredientTable*/
        let ingredientTable = "<table class = 'ingr' border = '1'><tr><th>Ingredient</th><th>Quantity</th><th>Measurement</th></tr>";
        while (currIngr < Number(result.numIngr)) {
            ingredientTable += `<tr><td>${result.ingredients[currIngr].ingredient}</td><td>${result.ingredients[currIngr].quantity}</td><td>${result.ingredients[currIngr].measurement}</td></tr>`;
            currIngr++;
        }
        ingredientTable += "</table>";
        
        let variables = {
            name: result.recipeName,
            servings: result.numServings,
            instructions: result.directions,
            ingrTable: ingredientTable,
            servSize: (result.totalWeight/result.numServings).toFixed(2),
            numServings: result.numServings,
            calsPerServ: Number(result.caloriesPerServ).toFixed(2),
            fatPerServ: Number(result.fatPerServ).toFixed(2),
            percFat: ((result.fatPerServ / 50) * 100).toFixed(2),
            carbsPerServ: Number(result.carbsPerServ).toFixed(2),
            percCarbs: ((result.carbsPerServ / 325) * 100).toFixed(2),
            proteinPerServ: Number(result.proteinPerServ).toFixed(2),
            percProtein: ((result.proteinPerServ / 50) * 100).toFixed(2),
            fiberPerServ: Number(result.fiberPerServ).toFixed(2),
            percFiber: ((result.fiberPerServ / 28) * 100).toFixed(2)
        };

        response.render("displayRecipeInfo", variables);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
});

app.post("/addRecipe", async (request, response) => {
    var totalCalories = 0;
    var totalProtein = 0;
    var totalCarbs = 0;
    var totalFat = 0;
    var totalFiber = 0;
    var totalWeight = 0;      
    var ingrList;
    var quanList;
    var measList;
    var ingrArr = [];

    /*putting ingredients, quantifiers, and measurement types into an array if they aren't already,
    since we loop through an array to access them */
    if (request.body.numIngr == 1) {
        ingrList = [request.body.ingr];
        quanList = [request.body.quantity];
        measList = [request.body.type];
    } else {
        ingrList = request.body.ingr;
        quanList = request.body.quantity;
        measList = request.body.type;
    }

    var ingredientTable = "<table class = 'ingr' border = '1'><tr><th>Ingredient</th><th>Quantity</th><th>Measurement</th></tr>";
    var currIngr = 0;
    const numIngr = ingrList.length;

    /*looping through the 3 different arrays to correctly calculate the different things we need */
    while (currIngr < numIngr) {

        /*API stuff */
        const options = {
            method: 'GET',
            url: 'https://edamam-food-and-grocery-database.p.rapidapi.com/api/food-database/v2/parser',
            params: {
                ingr: ingrList[currIngr],
                'nutrition-type': 'cooking',
                'category[0]': 'generic-foods',
            },
            headers: {
                'X-RapidAPI-Key': '9badb0a443mshf08aa26a16c26b6p14df55jsn72a30af900e4',
                'X-RapidAPI-Host': 'edamam-food-and-grocery-database.p.rapidapi.com'
            }
        };

        try {
            /*using axios to get the information returned by the API*/
            const response = await axios.request(options);

            let ingrInfo = {ingredient: ingrList[currIngr], quantity: quanList[currIngr], measurement: measList[currIngr]};
            ingrArr.push(ingrInfo);

            ingredientTable += `<tr><td>${ingrList[currIngr]}</td><td>${quanList[currIngr]}</td><td>${measList[currIngr]}</td></tr>`;

            nutrients = response.data.parsed[0].food.nutrients; //(this is per 100g)

            //then to get the weight in grams that the recipe calls for, you do:
            let measurement = measList[currIngr];
            let quantity = quanList[currIngr];
            let weight;

            /*
            The API has an array of hints that contains different variations of the ingredient 
            entered. The objects in the hints array contain measurements whereas
            response.data.food does not.
            For now this is ok but maybe later you should get back in and correctly find the
            right item in the hints array, since the first item may not be the exact ingredient
            entered (although it seems to be a pretty close match usually).
            */
            response.data.hints[0].measures.forEach(item => {
                if (item.label === measurement) {
                    weight = quantity * Number(item.weight);
                }
            });

            /*total weight is in grams (everything is calculated in grams) */
            totalWeight += weight;

            let quantifier = weight / 100;

            /* 
            The nutrient values given by the API are per 100 grams which, explaining
            these calculations to get the correct amount of nutrients for the inputted 
            amount of ingredient
            */
            totalCalories += (Number(quantifier) * Number(nutrients.ENERC_KCAL));
            totalProtein += (quantifier * Number(nutrients.PROCNT));
            totalFat += (quantifier * Number(nutrients.FAT));
            totalCarbs += (quantifier * Number(nutrients.CHOCDF));
            totalFiber += (quantifier * Number(nutrients.FIBTG));

        } catch (error) {
            console.error(error);
        }
        currIngr++;
    }

    const numServings = Number(request.body.numServings);
    
    let caloriesPerServ = (totalCalories / numServings).toFixed(2);
    let proteinPerServ = (totalProtein / numServings).toFixed(2);
    let fatPerServ = (totalFat / numServings).toFixed(2);
    let fiberPerServ = (totalFiber / numServings).toFixed(2);
    let carbsPerServ = (totalCarbs / numServings).toFixed(2);

    ingredientTable += "</table>";

    let variables = {
        name: request.body.recipeName,
        servings: request.body.numServings,
        instructions: request.body.prepInfo,
        ingrTable: ingredientTable,
        servSize: (totalWeight/request.body.numServings).toFixed(2),
        numServings: request.body.numServings,
        calsPerServ: Number(caloriesPerServ).toFixed(2),
        fatPerServ: Number(fatPerServ).toFixed(2),
        percFat: ((fatPerServ / 50) * 100).toFixed(2),
        carbsPerServ: Number(carbsPerServ).toFixed(2),
        percCarbs: ((carbsPerServ / 325) * 100).toFixed(2),
        proteinPerServ: Number(proteinPerServ).toFixed(2),
        percProtein: ((proteinPerServ/50) * 100).toFixed(2),
        fiberPerServ: Number(fiberPerServ).toFixed(2),
        percFiber: ((fiberPerServ / 28) * 100).toFixed(2)
    };

    let obj = {
        recipeName: request.body.recipeName,
        numServings: request.body.numServings,
        directions: request.body.prepInfo,
        numIngr: request.body.numIngr,
        ingredients: ingrArr,
        totalCalories: totalCalories,
        totalCarbs: totalCarbs,
        totalFat: totalFat,
        totalFiber: totalFiber,
        totalProtein: totalProtein,
        caloriesPerServ: caloriesPerServ,
        carbsPerServ: carbsPerServ,
        fatPerServ: fatPerServ,
        fiberPerServ: fiberPerServ,
        proteinPerServ: proteinPerServ,
        totalWeight: totalWeight
    };

    /* adding the created object to the database*/
    try {
        await client.connect();
        await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(obj);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }

    response.render("displayRecipeInfo", variables);
});