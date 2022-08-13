const express = require('express')
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000;
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

//hospital_portal
// lP97daBpENi9Dd82
app.use(cors())
app.use(express())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fwlhtlh.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const doctorsCollection = client.db("doctors").collection("services");
        const bookingCollection = client.db("doctors").collection("bookings");

        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = doctorsCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        });

        // new database for booking

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            console.log(req.body)
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        })








    }
    finally {

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello doctor!')
})

app.listen(port, () => {
    console.log(`doctoral ${port}`)
})