const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vlz3r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

async function run() {
  try {
    await client.connect();
    const donationUserCollection = client.db('BloodDonation').collection('users');
    const donationCollection = client.db('BloodDonation').collection('donation');
    const BlogCollection = client.db('BloodDonation').collection('blogs');

    // JWT Route to generate token
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });

    // Middleware to verify JWT token
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'Unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'Unauthorized access' });
        }
        req.decoded = decoded;
        next();
      });
    };

    // Middleware to verify if user is an admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await donationUserCollection.findOne({ email });
      if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    };

    // Middleware to verify if user is a donor
    const verifyVolunteer = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await donationUserCollection.findOne({ email });
      if (user?.role !== 'volunteer') {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    };
    // Middleware to verify if user is a donor
    const verifyDonor = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await donationUserCollection.findOne({ email });
      if (user?.role !== 'donor') {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    };

    // Get all donation requests, can filter by donationStatus or email
    app.get('/donationRequest', async (req, res) => {
      const { donationStatus, email } = req.query;
      let query = {};
      if (donationStatus) query.donationStatus = donationStatus;
      if (email) query.email = email;

      try {
        const result = await donationCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: 'Failed to fetch donation requests' });
      }
    });

    // Get a single donation request by ID
    app.get('/donationRequest/:id',  async (req, res) => {
      const id = req.params.id;
      try {
        const result = await donationCollection.findOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: 'Failed to fetch donation request' });
      }
    });

    // Update donation request (status or other fields)
    app.put('/donationRequest/:id', verifyToken, async (req, res) => {
      const { id } = req.params;
      const { donationStatus, requesterName, requesterEmail } = req.body;
      const updateFields = {};

      // Update donation status
      if (donationStatus) {
        updateFields.donationStatus = donationStatus;
      }

      // Update requester information
      if (requesterName) updateFields.requesterName = requesterName;
      if (requesterEmail) updateFields.requesterEmail = requesterEmail;

      // Set donation date if status is 'inprogress'
      if (donationStatus === 'inprogress') {
        updateFields.donationDate = new Date();
      }

      try {
        const result = await donationCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateFields }
        );
        if (result.modifiedCount > 0) {
          res.status(200).send({ message: 'Donation request updated successfully' });
        } else {
          res.status(400).send({ message: 'Failed to update donation request' });
        }
      } catch (error) {
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    // Get all donation requests by the logged-in user (pagination supported)
    app.get('/my-donation-requests', verifyToken, async (req, res) => {
      const email = req.decoded.email;
      const { donationStatus, page = 1, limit = 10 } = req.query;
      const query = donationStatus ? { requesterEmail: email, donationStatus } : { requesterEmail: email };

      try {
        const donationRequests = await donationCollection
          .find(query)
          .skip((page - 1) * limit)
          .limit(Number(limit))
          .toArray();

        const totalRequests = await donationCollection.countDocuments(query);
        const totalPages = Math.ceil(totalRequests / limit);

        res.json({ donationRequests, totalRequests, totalPages });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch donation requests' });
      }
    });

    // Add a new donation request
    app.post('/donation-requests', verifyToken, async (req, res) => {
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
        requestMessage
      } = req.body;

      // Check if the user is blocked
      const email = req.decoded.email;
      const user = await donationUserCollection.findOne({ email });
      if (user.status === 'blocked') {
        return res.status(403).send({ message: 'You are blocked and cannot make donation requests' });
      }

      // Create new donation request object
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
        donationStatus: 'pending' // Default status
      };

      try {
        const result = await donationCollection.insertOne(newDonationRequest);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to create donation request' });
      }
    });

   

    
    // Get a user (donor or admin) by email
    app.get('/users/donor/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }

      const user = await donationUserCollection.findOne({ email });
      const donor = user?.role === 'donor';
      res.send({ donor });
    });

    // Get a user (donor or admin) by email
    app.get('/users/volunteer/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }

      const user = await donationUserCollection.findOne({ email });
      const volunteer = user?.role === 'donor';
      res.send({ volunteer });
    });

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }

      const user = await donationUserCollection.findOne({ email });
      const admin = user?.role === 'admin';
      res.send({ admin });
    });

    // Get all users (admin only)
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
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

        res.json({ users, totalUsers, totalPages });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
      }
    });

    // Create a new user (for registration)
    app.post('/users', async (req, res) => {
      const user = req.body;
      try {
        const result = await donationUserCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: 'Failed to add user' });
      }
    });

    // Block or unblock a user
    app.put('/users/block/:id', verifyToken, verifyAdmin, async (req, res) => {
      const userId = req.params.id;
      const result = await donationUserCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { status: 'blocked' } }
      );
      res.send(result);
    });

    app.put('/users/unblock/:id', verifyToken, verifyAdmin, async (req, res) => {
      const userId = req.params.id;
      const result = await donationUserCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { status: 'active' } }
      );
      res.send(result);
    });

    // Make a user an admin
    app.put('/users/make-admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const userId = req.params.id;
      const result = await donationUserCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { role: 'admin' } }
      );
      res.send(result);
    });

    // Make a user a volunteer
    app.put('/users/make-volunteer/:id', verifyToken, verifyAdmin, async (req, res) => {
      const userId = req.params.id;
      const result = await donationUserCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { role: 'volunteer' } }
      );
      res.send(result);
    });
    //blogs collection
    app.post('/blogs',  async (req, res) => {
      
        const { title, content, date, thumbnail } = req.body;
        // Insert the blog data into your MongoDB collection
        const newBlog = {
          title,
          content,     
          date, 
          thumbnail,     
          status: 'draft', 
        };
        const result = await BlogCollection.insertOne(newBlog);
        res.send(result)
  });

  // Fetch blogs based on status (draft or published)
  app.get('/blogs/data', async (req, res) => {
      const blogs =  await BlogCollection.find().toArray();
      res.send(blogs)
  });
  app.get('/blogs/data/:id', async (req, res) => {
    const id = req.params.id;
    const query = {_id: new ObjectId(id)}
      const blogs =  await BlogCollection.findOne(query)
      res.send(blogs)
  });
  app.get('/blogs', async (req, res) => {
    const { status } = req.query;
      const blogs =  await BlogCollection.find({ status }).toArray();
      res.send(blogs)
  });

  // Publish a blog (only admin can do this)
  app.put('/blogs/publish/:id', verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    try {
      const result = await BlogCollection.updateOne(query, {
        $set: { status: 'published' }
      });
  
      if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Blog not found' });
      }
  
      // Fetch the updated blog to return
      const updatedBlog = await BlogCollection.findOne(query);
      res.status(200).json(updatedBlog);
    } catch (error) {
      console.error('Error publishing blog:', error);
      res.status(500).json({ message: 'Failed to publish blog' });
    }
  });
  
  
  // Unpublish a blog (only admin can do this)
  app.put('/blogs/unpublish/:id', verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    try {
      const result = await BlogCollection.updateOne(query, {
        $set: { status: 'draft' }
      });
  
      if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Blog not found' });
      }
  
      // Fetch the updated blog to return
      const updatedBlog = await BlogCollection.findOne(query);
      res.status(200).json(updatedBlog);
    } catch (error) {
      console.error('Error unpublishing blog:', error);
      res.status(500).json({ message: 'Failed to unpublish blog' });
    }
  });
  

// Delete a blog (only admin can do this)
app.delete('/blogs/:id', verifyToken, verifyAdmin, async (req, res) => {
 
  const id = req.params.id;
  const query = { _id: new ObjectId(id)}
  const result = await BlogCollection.deleteOne(query)
  res.send(result)
});
    

  

    app.delete('/donationRequest/:id', async(req,res)=>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id)}
      const result = await donationCollection.deleteOne(query)
      res.send(result)
    
    })

  } finally {
    // Ensure client will close when done
  }
}
run().catch(console.dir);

// Start the server
app.listen(7000, () => {
  console.log('Server is running on port 7000');
});
