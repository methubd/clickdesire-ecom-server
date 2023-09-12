const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors())
app.use(express.json())

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if(!authorization){
    return res.status(401).send({error: true, message: 'Unauthorized Access'})
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.AuthC, (error, decoded) => {
    if(error){
      return res.status(403).send({error: true, message: 'Unauthorized Access'})
    }
    req.decoded = decoded;
    next();
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster1.some2ew.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();
    
    // Data Tables
    const userCollections = client.db('SimpleECommerce').collection('users');
    const productsCollection = client.db('SimpleECommerce').collection('products');
    const cartItemsCollection = client.db('SimpleECommerce').collection('cart-items');
    const ordersCollection = client.db('SimpleECommerce').collection('orders');


    // JWT
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.AuthC, {expiresIn: '1hr'})
      res.send({token});
    })

    // Admin Verify Middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {userEmail: email};
      const user = await userCollections.findOne(query)
      if (user?.userRole !== 'admin') {
        res.status(403).send({
          error: true,
          message: "Forbidden Access",
        })
      }
      next();
    }

    // Orders Route
    app.post('/orders', async (req, res) => {
      const email = req.body.email;
      const filter = {customerEmail: email}
      const action = await cartItemsCollection.deleteMany(filter);
      const newOrder = req.body;
      const result = await ordersCollection.insertOne(newOrder);
      res.send(result)
    })

    app.get('/pending-orders', verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const query = {status: 'Pending', email: email};
      const result = await ordersCollection.find(query).toArray();
      res.send(result);
    })

    // Product Routes
    app.post('/products', verifyJWT, async (req, res) => {
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    })

    app.get('/products', async (req, res) => {
      const result = await productsCollection.find().toArray();
      res.send(result);
    })

    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await productsCollection.findOne(query);
      res.send(result)
    })

    // Cart Item Routes
    app.post('/cart-items', verifyJWT, async (req, res) => {
      const newCartItem = req.body;
      const result = await cartItemsCollection.insertOne(newCartItem);
      res.send(result);
    })

    app.get('/added-cart-items/:email', async (req, res) => {
      const email = req.params.email;
      const query = {customerEmail : email};
      const result = await cartItemsCollection.find(query).toArray();
      res.send(result);
    })

    app.delete('/added-cart-items/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result =  await cartItemsCollection.deleteOne(query);
      res.send(result)
    })

    // User Routes
    app.post('/users', async (req, res) => {
        const newUser = req.body;
        const query = {userEmail: newUser.userEmail};
        const searchResult = await userCollections.findOne(query)
        if (searchResult) {
          return
        }
        else{
          const result = await userCollections.insertOne(newUser);
          res.send(result)
        }
    })

    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollections.find().toArray();
      res.send(result);
    })

    app.put('/users/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requestRole = req.body;

      const filter = {userEmail: email}
      const options = {upsert: true}
      const newRole = {
        $set: {
          userRole: requestRole.userRole
        }
      }
      const result = await userCollections.updateOne(filter, newRole, options)
      res.send(result)
    })

    // Checking Admin Authorization
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = {userEmail: email}
      const user = await userCollections.findOne(query);
      const result = {isAdmin : user?.userRole === 'admin'}
      res.send(result.isAdmin);
    })

    // Checking Vendor Authorization
    app.get('/users/vendor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = {userEmail: email}
      const user = await userCollections.findOne(query);
      const result = {isVendor : user?.userRole === 'vendor'}
      res.send(result.isVendor);
    })

    
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Simple E commerce Servier');
})

app.listen(port, () => {
    console.log('Simple Server is running on port:', port);
});