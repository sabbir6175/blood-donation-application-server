const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 7000;
const { MongoClient, ServerApiVersion ,ObjectId  } = require('mongodb');



app.use(cors());
app.use(express.json())





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vlz3r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    await client.connect();

    const donationUserCollection = client.db('BloodDonation').collection('users');
    const donationCollection = client.db('BloodDonation').collection('donation')


    app.get('/users', async (req, res) => {
      try {
        const { status = 'all', page = 1, limit = 10 } = req.query;
        const filter = status === 'all' ? {} : { status };
    
        const users = await donationUserCollection
          .find(filter)
          .skip((page - 1) * limit)
          .limit(Number(limit))
          .toArray();
        
        const totalUsers = await donationUserCollection.countDocuments(filter);
        const totalPages = Math.ceil(totalUsers / limit);
    
        res.json({
          users,
          totalUsers,
          totalPages,
        });
      } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
      }
    });
    
    app.post('/users', async (req, res) => {
      try {
        const user = req.body;
        const result = await donationUserCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ error: 'Failed to add user' });
      }
    });
    
    // Block a user
    app.put('/users/block/:id', async (req, res) => {
      try {
        const userId = req.params.id;
        if (!ObjectId.isValid(userId)) {
          return res.status(400).json({ error: 'Invalid user ID' });
        }
    
        const result = await donationUserCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { status: 'blocked' } }
        );
    
        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'User not found' });
        }
    
        res.json(result);
      } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).json({ error: 'Failed to block user' });
      }
    });
    
    // Unblock a user
    app.put('/users/unblock/:id', async (req, res) => {
      try {
        const userId = req.params.id;
        if (!ObjectId.isValid(userId)) {
          return res.status(400).json({ error: 'Invalid user ID' });
        }
    
        const result = await donationUserCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { status: 'active' } }
        );
    
        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'User not found' });
        }
    
        res.json(result);
      } catch (error) {
        console.error('Error unblocking user:', error);
        res.status(500).json({ error: 'Failed to unblock user' });
      }
    });
    
    // Make a user a volunteer
    app.put('/users/make-volunteer/:id', async (req, res) => {
      try {
        const userId = req.params.id;
        if (!ObjectId.isValid(userId)) {
          return res.status(400).json({ error: 'Invalid user ID' });
        }
    
        const result = await donationUserCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { role: 'volunteer' } }
        );
    
        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'User not found' });
        }
    
        res.json(result);
      } catch (error) {
        console.error('Error making user volunteer:', error);
        res.status(500).json({ error: 'Failed to make user volunteer' });
      }
    });
    
    // Make a user an admin
    app.put('/users/make-admin/:id', async (req, res) => {
      try {
        const userId = req.params.id;
        if (!ObjectId.isValid(userId)) {
          return res.status(400).json({ error: 'Invalid user ID' });
        }
    
        const result = await donationUserCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { role: 'admin' } }
        );
    
        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'User not found' });
        }
    
        res.json(result);
      } catch (error) {
        console.error('Error making user admin:', error);
        res.status(500).json({ error: 'Failed to make user admin' });
      }
    });
    



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);






app.get('/', (req, res) => {
  res.send('Server running !')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})