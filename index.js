const express = require('express')
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000;
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
var jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// const nodemailer = require("nodemailer");
// const mg = require('nodemailer-mailgun-transport');


//hospital_portal
// lP97daBpENi9Dd82
app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fwlhtlh.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

// const auth = {
//     auth: {
//         api_key: process.env.SEND_BOOKING_MESSSAGE

//     }
// }
// const nodemailerMailgun = nodemailer.createTransport(mg(auth));

// function sendAppointmentEmail(booking) {
//     const { date, slot, patient, patientName, treatment } = booking;

//     nodemailerMailgun.sendMail({
//         from: 'cchakma19@gmail.com',
//         to: patient, // An array if you have multiple recipients.
//         subject: `your appointment for ${treatment} is on ${date} at ${slot} is confirmed`,
//         text: `your appointment for ${treatment} is on ${date} at ${slot} is confirmed`,
//         //You can use "html:" to send HTML email content. It's magic!
//         html: `
//         <div>
//         <p>hello ${patientName}</p>

//         </div>

//         `
//         //You can use "text:" to send plain-text content. It's oldschool!

//     }, (err, info) => {
//         if (err) {
//             console.log(`Error: ${err}`);
//         }
//         else {
//             console.log(`Response: ${info}`);
//         }
//     });

// }
async function run() {
    try {
        await client.connect();
        const doctorsCollection = client.db("doctors").collection("services");
        const bookingCollection = client.db("doctors").collection("bookings");
        const usersCollection = client.db("doctors").collection("user");
        const adminDoctorCollection = client.db("doctors").collection("doctors");
        const paymentCollection = client.db("doctors").collection("payments");



        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await usersCollection.findOne({ email: requester })
            if (requesterAccount.role == 'admin') {
                next();

            }
            else {
                res.status(403).send({ message: "forbidden" });
            }

        }



        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = doctorsCollection.find(query).project({ name: 1 });
            const services = await cursor.toArray();
            res.send(services);
        });
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        });
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin'
            res.send({ admin: isAdmin });
        })

        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;

            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send({ result });

        })


        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;

            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });

        });


        app.get('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctors = await adminDoctorCollection.find().toArray();
            res.send(doctors)

        })

        app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await adminDoctorCollection.insertOne(doctor);
            res.send(result);

        })

        app.delete('/doctor/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await adminDoctorCollection.deleteOne(query);
            res.send(result)
        })

        app.get('/available', async (req, res) => {
            const date = req.query.date;


            // step 1:  get all services
            const services = await doctorsCollection.find().toArray();

            // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();

            // step 3: for each service
            services.forEach(service => {
                // step 4: find bookings for that service. output: [{}, {}, {}, {}]
                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                // step 5: select slots for the service Bookings: ['', '', '', '']
                const bookedSlots = serviceBookings.map(book => book.slot);
                // step 6: select those slots that are not in bookedSlots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                //step 7: set available to slots to make it easier 
                service.slots = available;
            });


            res.send(services);
        })


        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient;
            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const bookings = await bookingCollection.find(query).toArray();
                return res.send(bookings);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }
        })

        app.get('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const booking = await bookingCollection.findOne(query);
            res.send(booking)

        })

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']

            })
            res.send({ clientSecret: paymentIntent.client_secret });

        })
        app.patch('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId

                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updateBooking = await bookingCollection.updateOne(filter, updatedDoc);
            res.send(updateBooking)
        })


        app.post('/booking', async (req, res) => {

            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exist = await bookingCollection.findOne(query);
            if (exist) {
                return res.send({ success: false, booking: exist })
            }
            const result = await bookingCollection.insertOne(booking);
            // console.log('sending email')
            // sendAppointmentEmail(booking)
            res.send({ success: true, result })
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