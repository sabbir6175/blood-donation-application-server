const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 7000;
// const stripe = require("stripe")(`${process.env.YOUR_STRIPE_SECRET_KEY}`);
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors({
  origin: ['https://blood-donation-c92df.web.app'], 
  credentials: true, 
}));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vlz3r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();
    const donationUserCollection = client
      .db("BloodDonation")
      .collection("users");
    const donationCollection = client
      .db("BloodDonation")
      .collection("donation");
    const BlogCollection = client.db("BloodDonation").collection("blogs");
    const FundingCollection = client.db("BloodDonation").collection("funding");

    // JWT Route to generate token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // Middleware to verify JWT token
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      // console.log('token :',token)
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
    
        req.decoded = decoded;
        // console.log("Decoded payload:", decoded); 
        next();
      });
    };

    // Middleware to verify if user is an admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await donationUserCollection.findOne({ email });
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    // Middleware to verify if user is a donor
    const verifyVolunteer = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await donationUserCollection.findOne({ email });
      if (user?.role !== "volunteer") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };
    // console.log(verifyVolunteer)
    // Middleware to verify if user is a donor
    const verifyDonor = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await donationUserCollection.findOne({ email });
      if (user?.role !== "donor") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

  // Endpoint for handling donations
// app.post("/funding", async (req, res) => {
//   const { amount, token, userEmail } = req.body;

//   try {
//     // Step 1: Charge the user using Stripe
//     const charge = await stripe.charges.create({
//       amount: amount * 100, // Stripe expects amount in cents
//       currency: "usd", // Change currency if needed
//       source: token.id, // The token received from Stripe Checkout
//       description: "Donation for the organization",
//     });

//     const donation = {
//       amount,
//       userEmail,
//       date: new Date(), // Store the current date and time
//     };

//     await FundingCollection.insertOne(donation); // Insert the donation record into the database

//     // Step 3: Send a response back to the client
//     res.status(200).json({ message: "Donation successful!" });
//   } catch (error) {
//     console.error("Payment failed:", error);
//     res.status(500).json({ error: "Payment failed, please try again." });
//   }
// });

    // // Endpoint to get funds (for pagination)
    // app.get("/funds", async (req, res) => {
    //   const { page = 1, limit = 10 } = req.query;
    //   const skip = (page - 1) * limit;

    //   // Fetch paginated funds from the database
    //   // Example: const funds = await Fund.find().skip(skip).limit(limit);

    //   // Fetch total funds for pagination
    //   // Example: const totalFunds = await Fund.countDocuments();

    //   res.status(200).json({
    //     funds, // Replace with actual funds data from the database
    //     totalFunds, // Replace with the total funds amount
    //   });
    // });

    app.get("/donationRequest/data", async (req, res) => {
      const result = await donationCollection
        .find({ donationStatus: "inprogress" })
        .toArray();
      res.send(result);
    });

    // Get all donation requests, can filter by donationStatus or email

    app.get("/donationRequest", async (req, res) => {
      const { donationStatus, email } = req.query;
      let query = {};
      if (donationStatus) query.donationStatus = donationStatus;
      if (email) query.email = email;

      try {
        const result = await donationCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch donation requests" });
      }
    });

    // Get a single donation request by ID
    app.get("/donationRequest/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await donationCollection.findOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch donation request" });
      }
    });

    app.patch("/donationRequestStatus/:id", async (req, res) => {
      const id = req.params.id;
      const updateDonation = req.body;
      const filter = { _id: new ObjectId(id) };
      const donationUpdate = {
        $set: {
          donationStatus: updateDonation.donationStatus,
          requesterName: updateDonation.requesterName,
          requesterEmail: updateDonation.requesterEmail,
        },
      };

      const result = await donationCollection.updateOne(filter, donationUpdate);

      if (result.modifiedCount === 0) {
        return res
          .status(404)
          .send({ message: "Donation request not found or no changes made" });
      }

      res
        .status(200)
        .send({ message: "Donation request updated successfully", result });
    });

    // Update donation request (status or other fields)
    app.patch("/donationRequest/:id", async (req, res) => {
      const id = req.params.id;
      const updateDonation = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const donationUpdate = {
        $set: {
          requesterName: updateDonation.requesterName,
          requesterEmail: updateDonation.requesterEmail,
          recipientName: updateDonation.recipientName,
          recipientDistrict: updateDonation.recipientDistrict,
          recipientUpazila: updateDonation.recipientUpazila,
          hospitalName: updateDonation.hospitalName,
          fullAddress: updateDonation.fullAddress,
          bloodGroup: updateDonation.bloodGroup,
          donationDate: updateDonation.donationDate,
          donationTime: updateDonation.donationTime,
          requestMessage: updateDonation.requestMessage,
          donationStatus: updateDonation.donationStatus,
        },
      };

      const result = await donationCollection.updateOne(
        filter,
        donationUpdate,
        options
      );
      if (result.modifiedCount === 0) {
        return res
          .status(404)
          .send({ message: "Donation request not found or no changes made" });
      }
      res
        .status(200)
        .send({ message: "Donation request updated successfully", result });
    });

    // Get all donation requests by the logged-in user (pagination supported)
    app.get("/my-donation-requests", verifyToken, async (req, res) => {
      const email = req.decoded.email;
      const { donationStatus, page = 1, limit = 10 } = req.query;
      const query = donationStatus
        ? { requesterEmail: email, donationStatus }
        : { requesterEmail: email };

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
        res.status(500).json({ error: "Failed to fetch donation requests" });
      }
    });

    // Add a new donation request
    app.post("/donation-requests", verifyToken,   async (req, res) => {
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
        return res.status(403).send({
          message: "You are blocked and cannot make donation requests",
        });
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
        donationStatus: "pending", // Default status
      };

      try {
        const result = await donationCollection.insertOne(newDonationRequest);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to create donation request" });
      }
    });

    //role management email based
    app.get("/users/role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const user = await donationUserCollection.findOne({ email });
      const admin = user?.role === "admin";
      const volunteer = user?.role === "volunteer";
      const donor = user?.role === "donor";
      res.send({ admin, volunteer, donor });
    });

    // Get all users (admin only)
    app.get("/admin/users", verifyToken,  verifyAdmin, async (req, res) => {
      try {
        const { status = "all", page = 1, limit = 10 } = req.query;
        const filter = status === "all" ? {} : { status };
        const users = await donationUserCollection
          .find(filter)
          .skip((page - 1) * limit)
          .limit(Number(limit))
          .toArray();

        const totalUsers = await donationUserCollection.countDocuments(filter);
        const totalPages = Math.ceil(totalUsers / limit);

        res.json({ users, totalUsers, totalPages });
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
      }
    });
    app.get("/volunteer/user", verifyToken, verifyVolunteer,  async (req, res) => {
      try {
        const { status = "all", page = 1, limit = 10 } = req.query;
        const filter = status === "all" ? {} : { status };
        const users = await donationUserCollection
          .find(filter)
          .skip((page - 1) * limit)
          .limit(Number(limit))
          .toArray();

        const totalUsers = await donationUserCollection.countDocuments(filter);
        const totalPages = Math.ceil(totalUsers / limit);

        res.json({ users, totalUsers, totalPages });
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
      }
    });
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const result = await donationUserCollection.findOne({ email: email });
      res.send(result);
    });

    // Create a new user (for registration)
    app.post("/users", async (req, res) => {
      const user = req.body;
      try {
        const result = await donationUserCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: "Failed to add user" });
      }
    });

    // Block or unblock a user
    app.put("/users/block/:id", verifyToken, verifyAdmin, async (req, res) => {
      const userId = req.params.id;
      const result = await donationUserCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { status: "blocked" } }
      );
      res.send(result);
    });

    app.put(
      "/users/unblock/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const userId = req.params.id;
        const result = await donationUserCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { status: "active" } }
        );
        res.send(result);
      }
    );

    // Make a user an admin
    app.put(
      "/users/make-admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const userId = req.params.id;
        const result = await donationUserCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { role: "admin" } }
        );
        res.send(result);
      }
    );

    // Make a user a volunteer
    app.put(
      "/users/make-volunteer/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const userId = req.params.id;
        const result = await donationUserCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { role: "volunteer" } }
        );
        res.send(result);
      }
    );
    //profile updated
    app.put("/users/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateUser = req.body;
      const donationUserUpdate = {
        $set: {
          displayName: updateUser.displayName,
          photoURL: updateUser.photoURL,
          district: updateUser.district,
          upazila: updateUser.upazila,
          bloodGroup: updateUser.bloodGroup,
        },
      };

      try {
        const result = await donationUserCollection.updateOne(
          filter,
          donationUserUpdate,
          options
        );

        if (result.modifiedCount === 0) {
          return res.status(400).send({ message: "No changes made" });
        }

        res.send({ message: "Profile updated successfully" });
      } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).send({ message: "Server error" });
      }
    });
    //blogs collection
    app.post("/blogs", async (req, res) => {
      const { title, content, date, thumbnail } = req.body;
      // Insert the blog data into your MongoDB collection
      const newBlog = {
        title,
        content,
        date,
        thumbnail,
        status: "draft",
      };
      const result = await BlogCollection.insertOne(newBlog);
      res.send(result);
    });

    // Fetch blogs based on status (draft or published)
    app.get("/blogs/data", async (req, res) => {
      const blogs = await BlogCollection.find().toArray();
      res.send(blogs);
    });
    app.get("/blogs/data/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const blogs = await BlogCollection.findOne(query);
      res.send(blogs);
    });
    app.get("/blogs", async (req, res) => {
      const { status } = req.query;
      const blogs = await BlogCollection.find({ status }).toArray();
      res.send(blogs);
    });

    // Publish a blog (only admin can do this)
    app.put(
      "/blogs/publish/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        try {
          const result = await BlogCollection.updateOne(query, {
            $set: { status: "published" },
          });

          if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Blog not found" });
          }

          // Fetch the updated blog to return
          const updatedBlog = await BlogCollection.findOne(query);
          res.status(200).json(updatedBlog);
        } catch (error) {
          console.error("Error publishing blog:", error);
          res.status(500).json({ message: "Failed to publish blog" });
        }
      }
    );

    // Unpublish a blog (only admin can do this)
    app.put(
      "/blogs/unpublish/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        try {
          const result = await BlogCollection.updateOne(query, {
            $set: { status: "draft" },
          });

          if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Blog not found" });
          }

          // Fetch the updated blog to return
          const updatedBlog = await BlogCollection.findOne(query);
          res.status(200).json(updatedBlog);
        } catch (error) {
          console.error("Error unPublishing blog:", error);
          res.status(500).json({ message: "Failed to unpublish blog" });
        }
      }
    );

    // Delete a blog (only admin can do this)
    app.delete("/blogs/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await BlogCollection.deleteOne(query);
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationUserCollection.deleteOne(query);
      res.send(result);
    });
    app.delete("/donationRequest/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationCollection.deleteOne(query);
      res.send(result);
    });

      // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensure client will close when done
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
