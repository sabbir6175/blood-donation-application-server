const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken');
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

      //all collection 
    const donationUserCollection = client.db('BloodDonation').collection('users');
    const donationCollection = client.db('BloodDonation').collection('donation')
    const Blog = client.db('BloodDonation').collection('blogs')

    // jwt token 
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

      // middlewares 
      const verifyToken = (req, res, next) => {
        // console.log('inside verify token', req.headers.authorization);
        if (!req.headers.authorization) {
          return res.status(401).send({ message: 'unauthorized access' });
        }
        const token = req.headers.authorization.split(' ')[1];
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
          if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
          }
          req.decoded = decoded;
          next();
        })
      }

      // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await donationUserCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }
      // use verify admin after verifyToken
    const verifyDonor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await donationUserCollection.findOne(query);
      const isDonor = user?.role === 'donor';
      if (!isDonor) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }
    //get donation all data 
    app.get('/donationRequest',  async(req, res)=>{
      const { donationStatus } = req.query;  
      const query = donationStatus ? { donationStatus: donationStatus } : {}; 
      const result =await donationCollection.find(query).toArray()
      res.send(result)
    })
   
    app.get('/donationRequest/:id', verifyToken,  async (req, res) => {
      const id = req.params.id;
      // const query = {_id: id};
      const query = {_id: new ObjectId(id)}
      const result = await donationCollection.findOne(query);
      res.send(result);
    });
    
    // updated my donation request page pending to inprogress
    app.put('/donationRequest/:id', verifyToken,async (req, res) => {
      const { id } = req.params;
      const { requesterName, requesterEmail } = req.body;  
      try {
        const result = await donationCollection.updateOne(
          // { _id: id },  // Find the request by ID
          {_id: new ObjectId(id)},
          { 
            $set: { 
              donationStatus: 'inprogress',   
              requesterName,               
              requesterEmail,            
              donationDate: new Date() 
            }
          }
        );

        if (result.modifiedCount > 0) {
          return res.status(200).send({ message: "Donation confirmed, status updated." });
        } else {
          return res.status(400).send({ message: "Failed to update donation request." });
        }
      } catch (error) {
        console.error(error);
        return res.status(500).send({ message: "Internal server error." });
      }
    });
    //dashboard my donation requests router
    app.get('/my-donation-requests', verifyToken, async (req, res) => {
      const email = req.decoded.email; // Get the logged-in user's email
      const { donationStatus, page = 1, limit = 10 } = req.query; // Pagination and filter parameters

      // Construct the query object
      const query = donationStatus ? 
        { requesterEmail: email, donationStatus } : 
        { requesterEmail: email };

      try {
        const donationRequests = await donationCollection
          .find(query)
          .skip((page - 1) * limit) // Pagination: skip results based on page number
          .limit(Number(limit)) // Limit the number of results per page
          .toArray();

        const totalRequests = await donationCollection.countDocuments(query); // Count the total records for pagination
        const totalPages = Math.ceil(totalRequests / limit); // Calculate total pages

        res.json({
          donationRequests,
          totalRequests,
          totalPages,
        });
      } catch (error) {
        console.error('Error fetching donation requests:', error);
        res.status(500).json({ error: 'Failed to fetch donation requests' });
      }
    });

    
    app.put('/donationRequest/:id', verifyToken,  async (req, res) => {
      const { id } = req.params; 
      const { donationStatus } = req.body; 
    
      try {
        const result = await donationCollection.updateOne(
          { _id: new ObjectId(id) }, 
          { $set: { donationStatus } } 
        );
    
        if (result.modifiedCount > 0) {
          return res.status(200).send({ message: "Donation request status updated." });
        } else {
          return res.status(400).send({ message: "Failed to update donation request." });
        }
      } catch (error) {
        console.error(error);
        return res.status(500).send({ message: "Internal server error." });
      }
    });
    




    //get donation all data admin dashboard
    app.get('/donationRequest/data', verifyToken, verifyAdmin,  async(req, res)=>{ 
      const result =await donationCollection.find().toArray()
      res.send(result)
    })

    app.get('/users/donor/:email', verifyToken,  async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await donationUserCollection.findOne(query);
      let donor = false;
      if (user) {
        donor = user?.role === 'donor';
      }
      res.send({ donor });
    })
    
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await donationUserCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })

    // app.get('/users/data', verifyToken, async (req, res) => {
    //   console.log(req.headers)
    //     const totalUsers = await donationUserCollection.find().toArray()
    //     res.json({
    //       totalUsers
    //     });
    //   } 
    // );
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      console.log(req.headers)
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
    app.put('/users/block/:id', verifyToken, verifyAdmin, async (req, res) => {
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
    app.put('/users/unblock/:id', verifyToken, verifyAdmin, async (req, res) => {
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
    app.put('/users/make-volunteer/:id', verifyToken, verifyAdmin, async (req, res) => {
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
    app.put('/users/make-admin/:id', verifyToken, verifyAdmin, async (req, res) => {
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
    // delete user
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await donationUserCollection.deleteOne(query);
      res.send(result);
    })


    app.post('/donation-requests', verifyToken,  async (req, res) => {
   
        // Extract the request body data
        const {
          requesterName,
          requesterEmail,
          recipientName,
          recipientDistrict,
          recipientUpazila,
          hospitalName,
          fullAddress,
          bloodGroup,
          donationDate,
          donationTime,
          requestMessage,
        } = req.body;
    
        // Check if the user is blocked
        const email = req.decoded.email;
        const user = await donationUserCollection.findOne({ email });
    
        if (user.status === "blocked") {
          return res.status(403).send({ message: "You are blocked and cannot make donation requests." });
        }
    
        // Create the new donation request object
        const newDonationRequest = {
          requesterName,
          requesterEmail,
          recipientName,
          recipientDistrict,
          recipientUpazila,
          hospitalName,
          fullAddress,
          bloodGroup,
          donationDate,
          donationTime,
          requestMessage,
          donationStatus: "pending", // Default status
        };
    
        // Insert the donation request into the database
        const result = await donationCollection.insertOne(newDonationRequest);
        res.send(result)
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