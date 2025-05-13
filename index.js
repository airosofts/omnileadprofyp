const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const stripe = require("stripe"); // Stripe requires initialization after loading the environment
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

// Initialize Supabase client

// Load environment variables
dotenv.config(); // Ensure dotenv loads before accessing environment variables
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Verify that STRIPE_SECRET_KEY is loaded
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("Error: STRIPE_SECRET_KEY is not defined in the .env file.");
  process.exit(1); // Exit the application if the key is missing
}

// Initialize Stripe
const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 4000;
app.use(cors());
// Middleware
// app.use(cors({ origin: "https://airosofts.com" })); // Restrict to your domain
app.use(express.static(path.join(__dirname))); // Serve static files
app.use(cors()); // Allow cross-origin requests
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

async function sendProfessionalEmail(email, password) {
  try {
    const transporter = nodemailer.createTransport({
      service: "Gmail", // Replace with your email service provider if needed
      auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASSWORD, // Your email password
      },
    });

    // Bootstrap-inspired professional email template
    const emailTemplate = `
      <div style="font-family: 'Roboto', Arial, sans-serif; max-width: 700px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); overflow: hidden;">
        <!-- Header -->
        <div style="background-color: #7c7ff3; padding: 20px; text-align: center; color: white; font-size: 24px; font-weight: bold; border-bottom: 2px solid #e5e7eb;">
          Welcome to Omni Lead Pro
        </div>

        <!-- Body -->
        <div style="padding: 30px; background-color: #ffffff; line-height: 1.8; color: #333;">
          <p style="font-size: 16px; margin-bottom: 20px;">Dear Valued Customer,</p>
          <p style="font-size: 16px; margin-bottom: 20px;">Thank you for choosing <strong>Omni Lead Pro</strong> as your automation partner. We're excited to have you on board and are dedicated to supporting your automation journey.</p>

          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background-color: #f9f9f9; margin-bottom: 30px;">
            <h2 style="font-size: 18px; color: #7c7ff3; margin-bottom: 15px;">Your Login Credentials</h2>
            <p style="margin: 0; font-size: 16px;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 0; font-size: 16px;"><strong>Password:</strong> ${password}</p>
          </div>

          <p style="font-size: 16px; margin-bottom: 20px;">You can log in to your dashboard to access your purchased products:</p>
          <div style="text-align: center; margin-top: 20px;">
            <a href="https://web.omnilead.pro" style="background-color: #7c7ff3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);">Login to Dashboard</a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0;">If you did not request this email, please ignore it or contact our support team.</p>
          <p style="margin: 0; margin-top: 10px;">&copy; 2024 Omni Lead Pro. All rights reserved.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Omni Lead Pro Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to Omni Lead Pro - Your Login Credentials",
      html: emailTemplate,
    };

    await transporter.sendMail(mailOptions);
    //console.log("Email sent successfully to:", email);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
const plans = {
  prod1_basic: "price_1QeSqjG8ztKaoxw1zAoTTAOM",
  prod1_experteu: "price_1QeSsVG8ztKaoxw1Dhk9mx5d",
  prod1_proeu: "price_1QeSsVG8ztKaoxw1LMmPw6Eo",
  prod1_basicasia: "price_1R4wkTG8ztKaoxw1KRBfPR1O",
  prod1_expertasia: "price_1R4wkjG8ztKaoxw1fekJb0P1",
  prod1_professionalasia: "price_1R4wkxG8ztKaoxw1jZUaZCoK",
 
};

app.get("/subscribe", async (req, res) => {
  const planId = req.query.planId;

  //console.log(`Plan ID: ${planId}`);

  if (!plans[planId]) {
    return res.status(400).send("Invalid plan!");
  }

  try {
    const session = await stripeInstance.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plans[planId], quantity: 1 }],
      success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
    });
    // console.log("Stripe Session:", session);
    res.redirect(session.url);
  } catch (error) {
    console.error("Stripe Error:", error.message);
    res.status(500).send("Internal Server Error");
  }
});
app.get("/success", async (req, res) => {
  try {
    const session = await stripeInstance.checkout.sessions.retrieve(
      req.query.session_id,
      {
        expand: [
          "subscription",
          "subscription.plan.product",
          "line_items.data.price.product",
        ],
      }
    );

    const customer = session.customer_details || {};
    const subscription = session.subscription || {};
    const product = session.line_items?.data[0]?.price?.product || {};
    const productPrice = session.line_items?.data[0]?.price?.unit_amount || 0;

    if (
      !session.customer ||
      !subscription.id ||
      !product.id ||
      !customer.email
    ) {
      console.error("Missing required data from Stripe session.");
      return res
        .status(400)
        .send("Error: Missing required data from Stripe session.");
    }

    let customerId;
    const { data: existingCustomer, error: fetchCustomerError } = await supabase
      .from("customers")
      .select("id")
      .eq("email", customer.email);

    if (fetchCustomerError) {
      console.error(
        "Error fetching customer from Supabase:",
        fetchCustomerError
      );
      return res.status(500).send("Error verifying customer data.");
    }

    if (existingCustomer && existingCustomer.length > 0) {
      customerId = existingCustomer[0].id;

      const { error: subscriptionError } = await supabase
        .from("subscriptions")
        .upsert(
          {
            id: subscription.id,
            customer_id: customerId,
            product_id: product.id,
            product_name: product.name || "Unknown Product",
            product_price: productPrice / 100,
            status: subscription.status || "unknown",
            start_date: subscription.start_date
              ? new Date(subscription.start_date * 1000)
              : null,
            current_period_end: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000)
              : null,
          },
          { onConflict: "id" }
        );

      if (subscriptionError) {
        console.error(
          "Error updating subscription to Supabase:",
          subscriptionError
        );
        return res.status(500).send("Error updating subscription data.");
      }

      const newLicenseKey = generateLicenseKey();
      const registrationDate = new Date();
      const expiryDate = new Date(registrationDate);
      expiryDate.setMonth(registrationDate.getMonth() + 1);

      const { error: usersTableError } = await supabase.from("users").upsert(
        {
          username: customer.name || "Unknown User",
          email: customer.email,
          country: customer.address?.country || "Unknown",
          license_key: newLicenseKey,
          registration_date: registrationDate,
          expiry_date: expiryDate,
          product_id: product.id,
          payment_plan: subscription.plan?.nickname || "Unknown Plan",
          subid: subscription.id,
          cusid: session.customer,
          softwarelimit:
            subscription.plan?.nickname === "basic_asia" ? 20000 :
            subscription.plan?.nickname === "pro_asia" ? 70000 :
            subscription.plan?.nickname === "professional_asia" ? 200000 :
            subscription.plan?.nickname === "Basic" ? 20000 :
            subscription.plan?.nickname === "Pro" ? 70000 :
            subscription.plan?.nickname === "Professional" ? 200000:
            subscription.plan?.nickname === "test" ? 1000 : 0,
          softwarelimitremains:
            subscription.plan?.nickname === "basic_asia" ? 20000 :
            subscription.plan?.nickname === "pro_asia" ? 70000 :
            subscription.plan?.nickname === "professional_asia" ? 200000 :
            subscription.plan?.nickname === "Basic" ? 20000 :
            subscription.plan?.nickname === "Pro" ? 70000 :
            subscription.plan?.nickname === "Professional" ? 200000:
            subscription.plan?.nickname === "test" ? 1000 : 0,
        },
        { onConflict: "id" }
      );

      if (usersTableError) {
        console.error("Error updating user in users table:", usersTableError);
        return res.status(500).send("Error updating user data.");
      }

      await sendExistingUserEmail(customer.email);
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          id: session.customer,
          name: customer.name || "Unknown",
          email: customer.email,
          phone: customer.phone || null,
        })
        .select("id");

      if (customerError) {
        console.error("Error saving customer to Supabase:", customerError);
        return res.status(500).send("Error saving customer data.");
      }

      customerId = newCustomer[0].id;

      const randomPassword = generatePassword();

      const { error: websiteUserError } = await supabase
        .from("websiteusers")
        .upsert(
          {
            email: customer.email,
            password: randomPassword,
            registration_date: new Date(),
            stripe_customer_id: session.customer,
          },
          { onConflict: "email" }
        );

      if (websiteUserError) {
        console.error("Error saving user to websiteusers:", websiteUserError);
        return res.status(500).send("Error saving website user data.");
      }

      const licenseKey = generateLicenseKey();
      const registrationDate = new Date();
      const expiryDate = new Date(registrationDate);
      expiryDate.setMonth(registrationDate.getMonth() + 1);

      const softwareLimit =
      subscription.plan?.nickname === "basic_asia" ? 20000 :
            subscription.plan?.nickname === "pro_asia" ? 70000 :
            subscription.plan?.nickname === "professional_asia" ? 200000 :
            subscription.plan?.nickname === "Basic" ? 20000 :
            subscription.plan?.nickname === "Pro" ? 70000 :
            subscription.plan?.nickname === "Professional" ? 200000:
        subscription.plan?.nickname === "test" ? 1000 : 0;

      const { error: usersTableError } = await supabase.from("users").insert({
        username: customer.name || "Unknown User",
        email: customer.email,
        country: customer.address?.country || "Unknown",
        license_key: licenseKey,
        registration_date: registrationDate,
        expiry_date: expiryDate,
        product_id: product.id,
        payment_plan: subscription.plan?.nickname || "Unknown Plan",
        subid: subscription.id,
        cusid: session.customer,
        softwarelimit: softwareLimit,
        softwarelimitremains: softwareLimit,
      });

      if (usersTableError) {
        console.error("Error saving user to users table:", usersTableError);
        return res.status(500).send("Error saving user license data.");
      }

      const { error: subscriptionError } = await supabase
        .from("subscriptions")
        .insert({
          id: subscription.id,
          customer_id: customerId,
          product_id: product.id,
          product_name: product.name || "Unknown Product",
          product_price: productPrice / 100,
          status: subscription.status || "unknown",
          start_date: subscription.start_date
            ? new Date(subscription.start_date * 1000)
            : null,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : null,
        });

      if (subscriptionError) {
        console.error(
          "Error saving subscription to Supabase:",
          subscriptionError
        );
        return res.status(500).send("Error saving subscription data.");
      }

      await sendProfessionalEmail(customer.email, randomPassword);
    }

    console.log("Customer, subscription, and user data saved successfully.");
    res.redirect("https://omnilead.pro/thankyou.html");
  } catch (error) {
    console.error("Error retrieving session or saving data:", error);
    res.status(500).send("An unexpected error occurred.");
  }
});

const generateLicenseKey = () => {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 20 })
    .map(() => charset.charAt(Math.floor(Math.random() * charset.length)))
    .join("");
};

const generatePassword = () => {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
  return Array.from({ length: 12 })
    .map(() => charset.charAt(Math.floor(Math.random() * charset.length)))
    .join("");
};

// Function to send an email for existing users
// Function to send an email for existing users
async function sendExistingUserEmail(email) {
  try {
    const transporter = nodemailer.createTransport({
      service: "Gmail", // Replace with your email service provider if needed
      auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASSWORD, // Your email password
      },
    });
    // Email template for existing users
    const emailTemplate = `
      <div style="font-family: 'Roboto', Arial, sans-serif; max-width: 700px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); overflow: hidden;">
        <!-- Header -->
        <div style="background-color: #7c7ff3; padding: 20px; text-align: center; color: white; font-size: 24px; font-weight: bold; border-bottom: 2px solid #e5e7eb;">
          Thank You for Your Purchase!
        </div>

        <!-- Body -->
        <div style="padding: 30px; background-color: #ffffff; line-height: 1.8; color: #333;">
          <p style="font-size: 16px; margin-bottom: 20px;">Dear Valued Customer,</p>
          <p style="font-size: 16px; margin-bottom: 20px;">Thank you for choosing <strong>Omni Lead Pro</strong> again. We're excited to continue supporting your automation journey.</p>

          <p style="font-size: 16px; margin-bottom: 20px;">As you are already an existing user, you can log in to your dashboard to access your purchased products and manage your subscription:</p>

          <div style="text-align: center; margin-top: 20px;">
            <a href="https://web.omnilead.pro" style="background-color: #7c7ff3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);">Login to Dashboard</a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0;">If you have any questions, please contact our support team.</p>
          <p style="margin: 0; margin-top: 10px;">&copy; 2024 Omni Lead Pro. All rights reserved.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Omni Lead Pro Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Thank You for Your Purchase - Omni Lead Pro",
      html: emailTemplate,
    };

    await transporter.sendMail(mailOptions);
  ///  console.log("Existing user email sent successfully to:", email);
  } catch (error) {
    console.error("Error sending email to existing user:", error);
    throw error;
  }
}
app.get("/api/user-subscriptions", async (req, res) => {
  let mailAccount = req.headers.mailaccount;

  if (!mailAccount) {
    return res.status(401).json({ error: "Unauthorized. Token is missing." });
  }

  try {
    const email = mailAccount;

    if (!email) {
      return res.status(400).json({ error: "User email is required!" });
    }

    // Fetch all user data matching the email
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select(
        "subid, softwarelimit, softwarelimitremains, product_id, payment_platform"
      )
      .eq("email", email);

    if (userError || !userData || userData.length === 0) {
      console.error("Error fetching user data:", userError);
      return res.status(404).json({ error: "User not found." });
    }

    // Collect all subids for the user
    const subIds = userData.map((user) => user.subid).filter((id) => id);

    // Fetch subscriptions matching the subids
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("subscriptions")
      .select(
        "id, product_id, product_name, start_date, current_period_end, status, payment_platform, auto_renewal"
      )
      .in("id", subIds);

    if (subscriptionsError || !subscriptions || subscriptions.length === 0) {
      console.error("Error fetching subscriptions:", subscriptionsError);
      return res.status(404).json({ error: "Subscriptions not found." });
    }

    const products = [];

    for (const subscription of subscriptions) {
      // Fetch the software icon for the product
      const { data: productData, error: productError } = await supabase
        .from("Softwares Drive")
        .select('"software name", "software icon"')
        .eq("product_id", subscription.product_id);

      if (productError || !productData?.length) {
        console.warn(
          `No product details found for product_id: ${subscription.product_id}`
        );
        continue; // Skip this product and continue the loop
      }

      const user = userData.find((user) => user.subid === subscription.id);

      // Extract the plan name from the product name
      let planName = "Recurring Plan";
      if (
        subscription.product_name &&
        subscription.product_name.includes(" - ")
      ) {
        planName = subscription.product_name.split(" - ")[1];
      }

      // Get auto-renewal status - default to true if not specified
      const autoRenewal =
        subscription.auto_renewal !== undefined
          ? subscription.auto_renewal
          : true;

      products.push({
        id: subscription.id, // Include subscription ID for management
        name: subscription.product_name || productData[0]["software name"],
        logo: productData[0]["software icon"],
        plan: planName,
        start_date: subscription.start_date,
        next_billing_date: subscription.current_period_end,
        status: subscription.status,
        auto_renewal: autoRenewal,
        limit: user ? user.softwarelimit : 0,
        limit_used: user ? user.softwarelimit - user.softwarelimitremains : 0,
        payment_platform:
          subscription.payment_platform || user.payment_platform || "stripe", // Default to stripe if not specified
      });
    }

    res.json(products);
  } catch (error) {
    console.error("Error retrieving subscriptions:", error);
    res.status(500).json({ error: "An unexpected error occurred." });
  }
});
// Stripe Auto-Renewal Toggle API
// app.post("/stripe/toggle-auto-renewal", async (req, res) => {
//   try {
//     let mailAccount = req.headers.mailaccount;
//     const { subscriptionId, enableAutoRenewal } = req.body;

//     if (!mailAccount) {
//       return res.status(401).json({ error: "Unauthorized. Token is missing." });
//     }

//     if (!subscriptionId) {
//       return res.status(400).json({ error: "Subscription ID is required." });
//     }

//     const email = mailAccount;

//     // Verify that this subscription belongs to the user
//     const { data: userData, error: userError } = await supabase
//       .from("users")
//       .select("id")
//       .eq("email", email)
//       .eq("subid", subscriptionId)
//       .eq("payment_platform", "stripe");

//     if (userError || !userData || userData.length === 0) {
//       return res.status(403).json({ error: "You do not have permission to manage this subscription." });
//     }

//     // Get the subscription from Stripe
//     const subscription = await stripeInstance.subscriptions.retrieve(subscriptionId);

//     if (enableAutoRenewal) {
//       // Resume a subscription (remove cancel_at_period_end flag)
//       await stripeInstance.subscriptions.update(subscriptionId, {
//         cancel_at_period_end: false,
//       });

//       // Update subscription in database
//       await supabase
//         .from('subscriptions')
//         .update({
//           auto_renewal: true
//         })
//         .eq('id', subscriptionId)
//         .eq('payment_platform', 'stripe');

//       return res.status(200).json({
//         message: "Auto-renewal has been enabled successfully.",
//         auto_renewal: true
//       });

//     } else {
//       // Cancel at period end (disable auto-renewal)
//       await stripeInstance.subscriptions.update(subscriptionId, {
//         cancel_at_period_end: true,
//       });

//       // Update subscription in database
//       await supabase
//         .from('subscriptions')
//         .update({
//           auto_renewal: false
//         })
//         .eq('id', subscriptionId)
//         .eq('payment_platform', 'stripe');

//       // Format the current period end date
//       const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toLocaleDateString();

//       return res.status(200).json({
//         message: "Auto-renewal has been disabled. Your subscription will end on " + currentPeriodEnd,
//         auto_renewal: false
//       });
//     }

//   } catch (error) {
//     console.error('Error toggling Stripe auto-renewal:', error);
//     res.status(500).json({ error: "Failed to update auto-renewal settings. Please try again later." });
//   }
// });
// // PayPal Auto-Renewal Toggle API
// // PayPal Auto-Renewal Toggle API
// app.post("/paypal/toggle-auto-renewal", async (req, res) => {
//   try {
//     let mailAccount = req.headers.mailaccount;
//     const { subscriptionId, enableAutoRenewal } = req.body;

//     if (!mailAccount) {
//       return res.status(401).json({ error: "Unauthorized. Token is missing." });
//     }

//     if (!subscriptionId) {
//       return res.status(400).json({ error: "Subscription ID is required." });
//     }

//     const email = mailAccount;

//     // Verify that this subscription belongs to the user
//     const { data: userData, error: userError } = await supabase
//       .from("users")
//       .select("id")
//       .eq("email", email)
//       .eq("subid", subscriptionId)
//       .eq("payment_platform", "paypal");

//     if (userError || !userData || userData.length === 0) {
//       return res.status(403).json({ error: "You do not have permission to manage this subscription." });
//     }

//     // Get PayPal access token
//     const accessToken = await getPayPalAccessToken();

//     // Get current subscription details
//     const subscriptionResponse = await axios({
//       method: 'get',
//       url: `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`,
//       headers: {
//         'Authorization': `Bearer ${accessToken}`,
//         'Content-Type': 'application/json'
//       }
//     });

//     const subscription = subscriptionResponse.data;

//     // Check if subscription status is valid for the requested operation
//     if (!enableAutoRenewal &&
//         subscription.status !== 'ACTIVE' &&
//         subscription.status !== 'SUSPENDED') {
//       return res.status(400).json({
//         error: `Cannot disable auto-renewal for a subscription with status ${subscription.status}. Status must be ACTIVE or SUSPENDED.`
//       });
//     }

//     if (enableAutoRenewal) {
//       // To enable auto-renewal on a subscription, we need to check if it's in a state that can be resumed
//       if (subscription.status !== 'ACTIVE' && subscription.status !== 'SUSPENDED') {
//         // For subscriptions in other states, just update our database
//         await supabase
//           .from('subscriptions')
//           .update({
//             auto_renewal: true
//           })
//           .eq('id', subscriptionId)
//           .eq('payment_platform', 'paypal');

//         return res.status(200).json({
//           message: "Auto-renewal settings updated in our records. However, the subscription may need to be reactivated through PayPal.",
//           auto_renewal: true
//         });
//       }

//       // If active or suspended, use the revise endpoint
//       await axios({
//         method: 'post',
//         url: `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/revise`,
//         headers: {
//           'Authorization': `Bearer ${accessToken}`,
//           'Content-Type': 'application/json'
//         },
//         data: {
//           plan_id: subscription.plan_id
//         }
//       });

//       // Update subscription in database
//       await supabase
//         .from('subscriptions')
//         .update({
//           auto_renewal: true
//         })
//         .eq('id', subscriptionId)
//         .eq('payment_platform', 'paypal');

//       return res.status(200).json({
//         message: "Auto-renewal has been enabled successfully.",
//         auto_renewal: true
//       });

//     } else {
//       // To disable auto-renewal, we cancel the subscription but set it to remain active until the end of the billing period
//       await axios({
//         method: 'post',
//         url: `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/cancel`,
//         headers: {
//           'Authorization': `Bearer ${accessToken}`,
//           'Content-Type': 'application/json'
//         },
//         data: {
//           reason: "Auto-renewal disabled by customer",
//           note: "Subscription will remain active until the current billing period ends."
//         }
//       });

//       // Update subscription in database
//       await supabase
//         .from('subscriptions')
//         .update({
//           auto_renewal: false
//         })
//         .eq('id', subscriptionId)
//         .eq('payment_platform', 'paypal');

//       return res.status(200).json({
//         message: "Auto-renewal has been disabled. Your subscription will end on " +
//                 new Date(subscription.billing_info.next_billing_time).toLocaleDateString(),
//         auto_renewal: false
//       });
//     }

//   } catch (error) {
//     console.error('Error toggling PayPal auto-renewal:',
//       error.response ? error.response.data : error.message);
//     res.status(500).json({
//       error: "Failed to update auto-renewal settings. Please try again later.",
//       details: error.response ? error.response.data : error.message
//     });
//   }
// });
// PayPal Subscription Renewal API
// app.post("/paypal/renew-subscription", async (req, res) => {
//   try {
//     let mailAccount = req.headers.mailaccount;
//     const { subscriptionId } = req.body;

//     if (!mailAccount) {
//       return res.status(401).json({ error: "Unauthorized. Token is missing." });
//     }

//     if (!subscriptionId) {
//       return res.status(400).json({ error: "Subscription ID is required." });
//     }

//     const email = mailAccount;

//     // Verify that this subscription belongs to the user
//     const { data: userData, error: userError } = await supabase
//       .from("users")
//       .select("id, product_id, payment_plan")
//       .eq("email", email)
//       .eq("subid", subscriptionId)
//       .eq("payment_platform", "paypal");

//     if (userError || !userData || userData.length === 0) {
//       return res.status(403).json({ error: "You do not have permission to renew this subscription." });
//     }

//     // Get the user's product ID and plan from the existing subscription
//     const productId = userData[0].product_id;
//     const planName = userData[0].payment_plan;

//     // Check if we have a valid product ID and plan
//     if (!productId || !planName) {
//       return res.status(400).json({ error: "Invalid product or plan information for this subscription." });
//     }

//     // Convert database product ID to URL parameter format (e.g., prod_RV7QoyIUfC3GRv → prod1)
//     // Map the database product IDs to URL product IDs
//     const productIdMapping = {
//       "prod_RV7QoyIUfC3GRv": "prod1", // Airo Web Data Extractor
//       "prod_RUVJGPpGaophaZ": "prod2"  // Airo Google Maps Data Extractor
//       // Add more mappings as needed
//     };

//     const urlProductId = productIdMapping[productId] || "prod1"; // Default to prod1 if not found

//     // Create the plan ID string in the format expected by the PayPal subscription endpoint
//     const planIdString = `${urlProductId}_${planName.toLowerCase()}`;

//     // Redirect to the PayPal subscribe endpoint with the plan ID
//     const subscribeUrl = `${process.env.BASE_URL}/paypal/subscribe?planId=${planIdString}`;

//     // Return the URL to redirect to
//     res.status(200).json({
//       message: "Ready to renew subscription",
//       redirect: subscribeUrl
//     });

//   } catch (error) {
//     console.error('Error processing PayPal subscription renewal:', error.message);
//     res.status(500).json({ error: "Failed to process renewal request. Please try again later." });
//   }
// });
// PayPal Subscription Cancellation API
// PayPal Subscription Cancellation API
app.post("/paypal/cancel-subscription", async (req, res) => {
  try {
    let mailAccount = req.headers.mailaccount;
    const { subscriptionId } = req.body;

    if (!mailAccount) {
      return res.status(401).json({ error: "Unauthorized. Token is missing." });
    }

    if (!subscriptionId) {
      return res.status(400).json({ error: "Subscription ID is required." });
    }

    const email = mailAccount;

    // Verify that this subscription belongs to the user
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .eq("subid", subscriptionId)
      .eq("payment_platform", "paypal");

    if (userError || !userData || userData.length === 0) {
      return res
        .status(403)
        .json({
          error: "You do not have permission to cancel this subscription.",
        });
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Cancel the subscription in PayPal
    const response = await axios({
      method: "post",
      url: `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/cancel`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        reason: "Cancelled by customer",
      },
    });

    // Update subscription in database
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        status: "canceled",
      })
      .eq("id", subscriptionId)
      .eq("payment_platform", "paypal");

    if (updateError) {
      console.error(
        `Error updating PayPal subscription ${subscriptionId}:`,
        updateError
      );
      return res
        .status(500)
        .json({ error: "Failed to update subscription status in database." });
    }

    // Update user records
    const { data: users, error: userUpdateError } = await supabase
      .from("users")
      .update({
        status: "canceled",
        softwarelimitremains: 0,
      })
      .eq("subid", subscriptionId)
      .eq("payment_platform", "paypal");

    if (userUpdateError) {
      console.error(
        `Error updating user records for subscription ${subscriptionId}:`,
        userUpdateError
      );
      return res
        .status(500)
        .json({ error: "Failed to update user status in database." });
    }

    // Return success response
    res.status(200).json({ message: "Subscription successfully cancelled" });
  } catch (error) {
    console.error(
      "Error cancelling PayPal subscription:",
      error.response ? error.response.data : error.message
    );
    res
      .status(500)
      .json({
        error: "Failed to cancel PayPal subscription. Please try again later.",
      });
  }
});
// Cancel
app.get("/cancel", async (req, res) => {
  res.redirect("https://www.omnilead.pro/");
});
app.get("/customers", async (req, res) => {
  try {
    let mailAccount = req.headers.mailaccount;

    if (!mailAccount) {
      return res.status(401).json({ error: "Unauthorized. Token is missing." });
    }

    const email = mailAccount;

    if (!email) {
      return res.status(400).json({ error: "Email is required in the token." });
    }

    // Fetch customer ID from the database
    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("email", email)
      .single();

    if (customerError || !customerData) {
      return res.status(404).json({ error: "Customer not found." });
    }

    const customerId = customerData.id;

    // Create a Stripe billing portal session
    const portalSession = await stripeInstance.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.BASE_URL}/`, // Redirect after managing subscription
    });

    // Send the Stripe portal URL back to the client
    res.json({ url: portalSession.url });
  } catch (error) {
    console.error(
      "Error creating customer portal session:",
      error.message || error
    );
    res
      .status(500)
      .json({ error: "Failed to create customer portal session." });
  }
});
// PayPal Integration - Complete Code without modules
const paypal = require('@paypal/checkout-server-sdk');
const crypto = require('crypto');
const axios = require('axios');

// Environment configuration
// Set this to false for production, true for testing
const PAYPAL_SANDBOX_MODE = false; 

// PayPal Subscription Plans - Structured by environment and product
const paypalPlans = {
  // SANDBOX PLANS
  sandbox: {
    // Product 1 (Airo Web Data Extractor)
    prod1: {
      basic: "P-26570462N8352815RNAD3TOA",
      expert: "P-43708783JT085293GNAD3TOI",
      professional: "P-4RR73105WB141680DNAD3TOQ",
      basicasia: "P-4TX63758581502208NAD3TOY",
      expertasia: "P-65421348AH3370419NAD3TOY",
      professionalasia: "P-1FY407913B664825VNAD3TPA",
      test: "P-7G803865D5893511FNAD5I5A"
    },
 
  },
  // LIVE PLANS - Replace with your live plan IDs when available
  live: {
    // Product 1 (Airo Web Data Extractor)
    prod1: {
      basic: "P-04769012YU492883BNAR3D5Y",
      expert: "P-1GW96025LN962894CNAR3D5Y",
      professional: "P-8LM21327WL843802FNAR3D6A",
      basicasia: "P-585494926J4431417NAR3D6I",
      expertasia: "P-15K55757PT795702XNAR3D6I",
      professionalasia: "P-2ET77452341489235NAR3D6Q"
    },
 
  }
};


const productIdMapping = {
  sandbox: {
    prod1: "PROD-82J36959P8165720M", // Airo Web Data Extractor
  },
  live: {
    prod1: "PROD-4UD55771GX0995310", // Airo Web Data Extractor
  }
};

// PayPal API configuration - Dynamic based on environment
const PAYPAL_BASE_URL = PAYPAL_SANDBOX_MODE 
  ? 'https://api-m.sandbox.paypal.com' 
  : 'https://api-m.paypal.com';
  
const PAYPAL_CLIENT_ID = PAYPAL_SANDBOX_MODE
  ? process.env.PAYPAL_SANDBOX_CLIENT_ID
  : process.env.PAYPAL_CLIENT_ID;
  
const PAYPAL_CLIENT_SECRET = PAYPAL_SANDBOX_MODE
  ? process.env.PAYPAL_SANDBOX_CLIENT_SECRET
  : process.env.PAYPAL_CLIENT_SECRET;
  
const PAYPAL_MANAGEMENT_BASE_URL = PAYPAL_SANDBOX_MODE
  ? 'https://www.sandbox.paypal.com'
  : 'https://www.paypal.com';

// Get the current environment for easier access throughout the code
function getCurrentEnvironment() {
  return PAYPAL_SANDBOX_MODE ? 'sandbox' : 'live';
}

// Get a plan ID based on product and plan name
function getPlanId(productId, planName) {
  const env = getCurrentEnvironment();
  
  if (!paypalPlans[env][productId]) {
    throw new Error(`Unknown product ID: ${productId} in ${env} environment`);
  }
  
  if (!paypalPlans[env][productId][planName]) {
    throw new Error(`Unknown plan: ${planName} for product: ${productId} in ${env} environment`);
  }
  
  return paypalPlans[env][productId][planName];
}

// Get PayPal SDK client based on environment
function getPayPalClient() {
  if (PAYPAL_SANDBOX_MODE) {
    const environment = new paypal.core.SandboxEnvironment(
      PAYPAL_CLIENT_ID,
      PAYPAL_CLIENT_SECRET
    );
    return new paypal.core.PayPalHttpClient(environment);
  } else {
    const environment = new paypal.core.LiveEnvironment(
      PAYPAL_CLIENT_ID,
      PAYPAL_CLIENT_SECRET
    );
    return new paypal.core.PayPalHttpClient(environment);
  }
}

// Get PayPal access token
async function getPayPalAccessToken() {
  try {
    const response = await axios({
      method: 'post',
      url: `${PAYPAL_BASE_URL}/v1/oauth2/token`,
      auth: {
        username: PAYPAL_CLIENT_ID,
        password: PAYPAL_CLIENT_SECRET
      },
      params: {
        grant_type: 'client_credentials'
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting PayPal access token:', 
      error.response ? error.response.data : error.message);
    throw error;
  }
}

// Parse the plan ID string to extract product ID and plan name
function parsePlanIdString(planIdString) {
  // Format: prodX_planname
  const parts = planIdString.split('_');
  if (parts.length < 2) {
    throw new Error("Invalid plan ID format. Expected format: prodX_planname");
  }
  
  const productId = parts[0]; // e.g., prod1, prod2, etc.
  const planName = parts.slice(1).join('_'); // In case plan name has multiple parts
  
  return { productId, planName };
}

// 1. Endpoint to create a PayPal subscription
app.get("/paypal/subscribe", async (req, res) => {
  const planIdString = req.query.planId;

  if (!planIdString) {
    return res.status(400).send("Missing plan ID!");
  }
  
  try {
    // Parse the plan ID string to get product ID and plan name
    const { productId, planName } = parsePlanIdString(planIdString);
    
    // Get the PayPal plan ID for the current environment
    const paypalPlanId = getPlanId(productId, planName);
    
    console.log(`Creating PayPal subscription in ${getCurrentEnvironment()} mode for product: ${productId}, plan: ${planName} (${paypalPlanId})`);
    
    const accessToken = await getPayPalAccessToken();
    
    // Create a subscription
    const response = await axios({
      method: 'post',
      url: `${PAYPAL_BASE_URL}/v1/billing/subscriptions`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'return=representation'
      },
      data: {
        plan_id: paypalPlanId,
        application_context: {
          brand_name: "AiroSofts",
          locale: "en-US",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${process.env.BASE_URL}/paypal/success?planIdString=${planIdString}`,
          cancel_url: `${process.env.BASE_URL}/cancel`
        }
      }
    });
    
    // Find approval URL in the links array
    const approvalUrl = response.data.links.find(link => link.rel === "approve").href;
    
    // Redirect the user to PayPal to approve the subscription
    res.redirect(approvalUrl);
  } catch (error) {
    console.error("PayPal Subscription Error:", error.response ? error.response.data : error.message);
    res.status(500).send("Error creating PayPal subscription");
  }
});

// 2. Success callback endpoint when user approves subscription
app.get("/paypal/success", async (req, res) => {
  try {
    const { subscription_id } = req.query;
    const planIdString = req.query.planIdString;
    
    if (!planIdString) {
      return res.status(400).send("Missing plan ID information");
    }
    
    if (!subscription_id && !req.query.token) {
      return res.status(400).send("Missing subscription details");
    }
    
    // If we have a token but not a subscription_id, we need to get subscription details
    let actualSubscriptionId = subscription_id;
    
    if (req.query.token && !subscription_id) {
      try {
        const accessToken = await getPayPalAccessToken();
        
        // Get subscription details by token
        const response = await axios({
          method: 'get',
          url: `${PAYPAL_BASE_URL}/v1/billing/subscriptions?token=${req.query.token}`,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.data.id) {
          throw new Error("Invalid subscription data received");
        }
        
        actualSubscriptionId = response.data.id;
      } catch (error) {
        console.error("Error processing PayPal token:", error.response ? error.response.data : error.message);
        return res.status(500).send("Error processing subscription approval");
      }
    }
    
    // Process the subscription
    await processPayPalSubscription(actualSubscriptionId, planIdString);
    
    // Redirect to thank you page
    res.redirect("https://omnilead.pro/thankyou.html");
  } catch (error) {
    console.error("PayPal Success Error:", error.response ? error.response.data : error.message);
    res.status(500).send("Error processing PayPal payment");
  }
});

async function processPayPalSubscription(subscriptionId, planIdString) {
  try {
    // Parse the plan ID string to get product ID and plan name
    const { productId, planName } = parsePlanIdString(planIdString);
    
    // Get subscription details
    const accessToken = await getPayPalAccessToken();
    
    const subscriptionResponse = await axios({
      method: 'get',
      url: `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const subscription = subscriptionResponse.data;
    
    // Extract customer information
    const customerEmail = subscription.subscriber.email_address;
    const customerName = subscription.subscriber.name 
      ? `${subscription.subscriber.name.given_name || ''} ${subscription.subscriber.name.surname || ''}`
      : "Unknown";
      
    // Create a PayPal-specific customer ID
    const paypalCustomerId = `paypal_${subscriptionId}`;
    
    // Get product details based on plan ID string
    const productDetails = getProductDetailsFromPlanIdString(planIdString);
    
    // Parse subscription timing details
    const startDate = new Date(subscription.start_time);
    const currentPeriodEnd = subscription.billing_info && subscription.billing_info.next_billing_time 
      ? new Date(subscription.billing_info.next_billing_time) 
      : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // Default to 30 days from now
    
    // Set initial subscription status
    const status = subscription.status === 'ACTIVE' ? 'active' : 'inactive';
    
    // Check if customer already exists
    const { data: existingCustomer, error: fetchCustomerError } = await supabase
      .from("customers")
      .select("id")
      .eq("email", customerEmail);
      
    if (fetchCustomerError) {
      console.error("Error fetching customer:", fetchCustomerError);
      throw new Error("Error verifying customer data.");
    }
    
    let customerId;
    
    if (existingCustomer && existingCustomer.length > 0) {
      // Existing customer flow
      customerId = existingCustomer[0].id;
      
      // Update subscription (or create if new)
      const { error: subscriptionError } = await supabase
        .from("subscriptions")
        .upsert(
          {
            id: subscriptionId,
            customer_id: customerId,
            product_id: productDetails.softwareProductId,
            product_name: productDetails.productName,
            product_price: productDetails.price,
            status: status,
            start_date: startDate,
            current_period_end: currentPeriodEnd,
            payment_platform: 'paypal',
          },
          { onConflict: "id" }
        );
        
      if (subscriptionError) {
        console.error("Error updating subscription:", subscriptionError);
        throw new Error("Error updating subscription data.");
      }
      
      // Check if a user record already exists for this specific subscription ID
      const { data: existingSubUser, error: existingSubUserError } = await supabase
        .from("users")
        .select("id")
        .eq("email", customerEmail)
        .eq("product_id", productDetails.softwareProductId)
        .eq("subid", subscriptionId);
        
      if (existingSubUserError) {
        console.error("Error checking for existing subscription user:", existingSubUserError);
        throw new Error("Error checking user data.");
      }
      
      const newLicenseKey = generateLicenseKey();
      const softwareLimit = getSoftwareLimitFromPlan(productId, planName);
      
      if (existingSubUser && existingSubUser.length > 0) {
        // Update the existing license for this specific subscription
        const { error: usersTableError } = await supabase
          .from("users")
          .update({
            username: customerName || "Unknown User",
            license_key: newLicenseKey,
            registration_date: startDate,
            expiry_date: currentPeriodEnd,
            payment_plan: productDetails.planName,
            status: status,
            softwarelimit: softwareLimit,
            softwarelimitremains: softwareLimit,
          })
          .eq("id", existingSubUser[0].id);
          
        if (usersTableError) {
          console.error("Error updating user:", usersTableError);
          throw new Error("Error updating user data.");
        }
      } else {
        // Insert a new user record for this new subscription
        const { error: usersTableError } = await supabase
          .from("users")
          .insert({
            username: customerName || "Unknown User",
            email: customerEmail,
            country: "Unknown",
            license_key: newLicenseKey,
            registration_date: startDate,
            expiry_date: currentPeriodEnd,
            product_id: productDetails.softwareProductId,
            payment_plan: productDetails.planName,
            subid: subscriptionId,
            cusid: paypalCustomerId,
            payment_platform: 'paypal',
            status: status,
            softwarelimit: softwareLimit,
            softwarelimitremains: softwareLimit,
          });
          
        if (usersTableError) {
          console.error("Error inserting user:", usersTableError);
          throw new Error("Error creating new user record.");
        }
      }
      
      // Send email to existing user
      await sendExistingUserEmail(customerEmail);
    } else {
      // New customer flow
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          id: paypalCustomerId,
          name: customerName || "Unknown",
          email: customerEmail,
          phone: null,
          payment_platform: 'paypal',
        })
        .select("id");
        
      if (customerError) {
        console.error("Error saving customer:", customerError);
        throw new Error("Error saving customer data.");
      }
      
      customerId = newCustomer[0].id;
      
      // Generate random password for new website user
      const randomPassword = generatePassword();
      
      // Create website user
      const { error: websiteUserError } = await supabase
        .from("websiteusers")
        .upsert(
          {
            email: customerEmail,
            password: randomPassword,
            registration_date: new Date(),
            paypal_customer_id: paypalCustomerId,
            payment_platform: 'paypal',
          },
          { onConflict: "email" }
        );
        
      if (websiteUserError) {
        console.error("Error saving website user:", websiteUserError);
        throw new Error("Error saving website user data.");
      }
      
      // Generate license key
      const licenseKey = generateLicenseKey();
      const softwareLimit = getSoftwareLimitFromPlan(productId, planName);
      
      // Create user record
      const { data: newUserData, error: usersTableError } = await supabase
        .from("users")
        .insert({
          username: customerName || "Unknown User",
          email: customerEmail,
          country: "Unknown", // PayPal doesn't always provide country
          license_key: licenseKey,
          registration_date: startDate,
          expiry_date: currentPeriodEnd,
          product_id: productDetails.softwareProductId,
          payment_plan: productDetails.planName,
          subid: subscriptionId,
          cusid: paypalCustomerId,
          payment_platform: 'paypal',
          status: status,
          softwarelimit: softwareLimit,
          softwarelimitremains: softwareLimit,
        })
        .select("id");
        
      if (usersTableError) {
        console.error("Error saving user:", usersTableError);
        throw new Error("Error saving user license data.");
      }
      
      // Create subscription record
      const { error: subscriptionError } = await supabase
        .from("subscriptions")
        .insert({
          id: subscriptionId,
          customer_id: customerId,
          product_id: productDetails.softwareProductId,
          product_name: productDetails.productName,
          product_price: productDetails.price,
          status: status,
          start_date: startDate,
          current_period_end: currentPeriodEnd,
          payment_platform: 'paypal',
        });
        
      if (subscriptionError) {
        console.error("Error saving subscription:", subscriptionError);
        throw new Error("Error saving subscription data.");
      }
      
      // Send welcome email with credentials
      await sendProfessionalEmail(customerEmail, randomPassword);
    }
    
    return true;
  } catch (error) {
    console.error("Error processing PayPal subscription:", error);
    throw error;
  }
}

// 3. PayPal Webhook Handler - Works for both environments
app.post('/paypal-webhook', express.json(), async (req, res) => {
  try {
    // Get PayPal webhook event
    const event = req.body;
    const eventType = event.event_type;
    
    console.log(`Received PayPal webhook in ${getCurrentEnvironment()} mode: ${eventType}`);
    
    // Verify webhook signature (Recommended for production)
    // This section would be enhanced in production with PayPal webhook signature verification
    
    // Process different webhook event types
    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.CREATED':
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handlePayPalSubscriptionEvent(event.resource, 'active');
        break;
        
      case 'BILLING.SUBSCRIPTION.UPDATED':
        await handlePayPalSubscriptionEvent(event.resource, null); // Use status from resource
        break;
        
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handlePayPalSubscriptionEvent(event.resource, 'canceled');
        break;
        
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handlePayPalSubscriptionEvent(event.resource, 'past_due');
        break;
        
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        await handlePayPalSubscriptionEvent(event.resource, 'canceled');
        break;
        
      case 'PAYMENT.SALE.COMPLETED':
        await handlePayPalPaymentEvent(event.resource, true);
        break;
        
      case 'PAYMENT.SALE.DENIED':
      case 'PAYMENT.SALE.REFUNDED':
      case 'PAYMENT.SALE.REVERSED':
        await handlePayPalPaymentEvent(event.resource, false);
        break;
    }
    
    // Acknowledge receipt of the event
    res.status(200).send('Webhook received');
  } catch (error) {
    console.error('Error processing PayPal webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

// 4. Handle PayPal subscription events
async function handlePayPalSubscriptionEvent(resource, forcedStatus = null) {
  try {
    const subscriptionId = resource.id;
    
    // Get access token
    const accessToken = await getPayPalAccessToken();
    
    // Get full subscription details
    const subscriptionResponse = await axios({
      method: 'get',
      url: `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const subscription = subscriptionResponse.data;
    
    // Map PayPal status to our internal status
    let status = forcedStatus;
    if (!status) {
      status = mapPayPalStatusToInternal(subscription.status);
    }
    
    // Get next billing time if available
    let currentPeriodEnd = subscription.billing_info?.next_billing_time 
      ? new Date(subscription.billing_info.next_billing_time) 
      : null;
      
    // Update subscription in database
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: status,
        current_period_end: currentPeriodEnd
      })
      .eq('id', subscriptionId)
      .eq('payment_platform', 'paypal');
      
    if (updateError) {
      console.error(`Error updating PayPal subscription ${subscriptionId}:`, updateError);
      return;
    }
    
    // Update user records
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('subid', subscriptionId)
      .eq('payment_platform', 'paypal');
      
    if (userError || !users || users.length === 0) {
      console.error(`Error finding users for PayPal subscription ${subscriptionId}:`, userError);
      return;
    }
    
    for (const user of users) {
      // Determine if we should reset credits
      let softwareLimitRemains = user.softwarelimitremains;
      
      if (status === 'canceled' || status === 'past_due') {
        // Zero out credits for canceled or past due subscriptions
        softwareLimitRemains = 0;
      } else if (status === 'active' && currentPeriodEnd && user.expiry_date && 
                 new Date(currentPeriodEnd) > new Date(user.expiry_date)) {
        // Reset credits for renewed subscriptions
        softwareLimitRemains = user.softwarelimit;
      }
      
      // Update user
      const { error } = await supabase
        .from('users')
        .update({
          expiry_date: currentPeriodEnd || user.expiry_date,
          status: status,
          softwarelimitremains: softwareLimitRemains
        })
        .eq('id', user.id);
        
      if (error) {
        console.error(`Error updating user ${user.id}:`, error);
      }
    }
    
    console.log(`Successfully processed subscription event for ${subscriptionId}`);
  } catch (error) {
    console.error('Error handling PayPal subscription event:', error);
  }
}

// 5. Handle PayPal payment events
async function handlePayPalPaymentEvent(resource, isSuccessful) {
  try {
    // Get subscription ID from billing agreement
    const subscriptionId = resource.billing_agreement_id;
    
    if (!subscriptionId) {
      console.log('Payment not associated with a subscription');
      return;
    }
    
    if (isSuccessful) {
      // Successful payment - update subscription status
      const accessToken = await getPayPalAccessToken();
      
      // Get subscription details
      const subscriptionResponse = await axios({
        method: 'get',
        url: `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const subscription = subscriptionResponse.data;
      
      // Update subscription status
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_end: subscription.billing_info?.next_billing_time 
            ? new Date(subscription.billing_info.next_billing_time) 
            : null
        })
        .eq('id', subscriptionId)
        .eq('payment_platform', 'paypal');
        
      if (updateError) {
        console.error(`Error updating PayPal subscription ${subscriptionId} after payment:`, updateError);
        return;
      }
      
      // Find users with this subscription
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('subid', subscriptionId)
        .eq('payment_platform', 'paypal');
        
      if (userError || !users || users.length === 0) {
        console.error(`Error finding users for PayPal subscription ${subscriptionId}:`, userError);
        return;
      }
      
      // Update each user's subscription details
      for (const user of users) {
        // Update user
        const { error } = await supabase
          .from('users')
          .update({
            expiry_date: subscription.billing_info?.next_billing_time 
              ? new Date(subscription.billing_info.next_billing_time) 
              : user.expiry_date,
            status: 'active',
            softwarelimitremains: user.softwarelimit // Reset to full credit limit on successful payment
          })
          .eq('id', user.id);
          
        if (error) {
          console.error(`Error updating user ${user.id}:`, error);
        }
      }
    } else {
      // Failed payment - update subscription to past_due
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'past_due'
        })
        .eq('id', subscriptionId)
        .eq('payment_platform', 'paypal');
        
      if (updateError) {
        console.error(`Error updating PayPal subscription ${subscriptionId} after payment issue:`, updateError);
        return;
      }
      
      // Find users with this subscription
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('subid', subscriptionId)
        .eq('payment_platform', 'paypal');
        
      if (userError || !users || users.length === 0) {
        console.error(`Error finding users for PayPal subscription ${subscriptionId}:`, userError);
        return;
      }
      
      // Update each user's subscription details
      for (const user of users) {
        // Update user - zero out remaining credits on payment issues
        const { error } = await supabase
          .from('users')
          .update({
            status: 'past_due',
            softwarelimitremains: 0
          })
          .eq('id', user.id);
          
        if (error) {
          console.error(`Error updating user ${user.id}:`, error);
        }
      }
    }
    
    console.log(`Successfully processed payment event for subscription ${subscriptionId}`);
  } catch (error) {
    console.error('Error handling PayPal payment event:', error);
  }
}

// 6. PayPal Subscription Management Portal - Works for both environments
app.get("/paypal/manage-subscription", async (req, res) => {
  try {
    let mailAccount = req.headers.mailaccount;
    
    if (!mailAccount) {
      return res.status(401).json({ error: "Unauthorized. Token is missing." });
    }
    
    const email = mailAccount;
    
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }
    
    // Get the user's PayPal subscriptions
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("subid, environment")
      .eq("email", email)
      .eq("payment_platform", "paypal");
      
    if (userError || !users || users.length === 0) {
      return res.status(404).json({ error: "No PayPal subscriptions found for this user." });
    }
    
    // Get all subscription IDs for this user
// Get all subscription IDs for this user
const subscriptionIds = users.map(user => user.subid);
    
// Get the environment for this user (assuming all subscriptions are in the same environment)
// If mixed environments, we prioritize using the current environment setting
let userEnvironment = users[0].environment || getCurrentEnvironment();

// Get active subscriptions
const { data: subscriptions, error: subError } = await supabase
  .from("subscriptions")
  .select("id")
  .eq("payment_platform", "paypal")
  .in("id", subscriptionIds)
  .in("status", ["active", "past_due"])
  .order("start_date", { ascending: false });
  
if (subError || !subscriptions || subscriptions.length === 0) {
  return res.status(404).json({ error: "No active PayPal subscriptions found." });
}

const latestSubscription = subscriptions[0];

// For PayPal, we redirect users to PayPal's subscription management portal
// Use the appropriate base URL based on the user's environment
const baseUrl = (userEnvironment === 'sandbox') 
  ? 'https://www.sandbox.paypal.com' 
  : 'https://www.paypal.com';
  
const managementUrl = `${baseUrl}/myaccount/autopay/${latestSubscription.id}`;

res.json({ url: managementUrl });
} catch (error) {
console.error("Error creating PayPal management URL:", error);
res.status(500).json({ error: "Failed to create subscription management URL." });
}
});

// Get product details from plan ID string
function getProductDetailsFromPlanIdString(planIdString) {
// Parse the plan ID string to get product ID and plan name
const { productId, planName } = parsePlanIdString(planIdString);

// Get the current environment
const env = getCurrentEnvironment();

// Map URL product IDs to actual database product IDs
// This mapping connects the URL parameter (prod1, prod2) to actual database IDs
const productSoftwareIdMapping = {
prod1: "prod_RXXw8vU86zL2At", // Airo Web Data Extractor
};

// Load products from database or configuration
const products = {
// Using URL product ID (prod1, prod2) as key
prod1: {
  softwareProductId: productSoftwareIdMapping.prod1, // Use the actual database product ID
  name: "Omni Lead Pro",
  plans: {
    basic: {
      name: "Basic",
      price: 9.99,
      softwareLimit: 10000
    },
    expert: {
      name: "Expert",
      price: 29.99,
      softwareLimit: 50000
    },
    professional: {
      name: "Professional",
      price: 59.99,
      softwareLimit: 250000
    },
    basicasia: {
      name: "Basic",
      price: 4.99,
      softwareLimit: 10000
    },
    expertasia: {
      name: "Expert",
      price: 9.99,
      softwareLimit: 50000
    },
    professionalasia: {
      name: "Professional",
      price: 19.99,
      softwareLimit: 250000
    }
  }
}
};

// Check if product exists
if (!products[productId]) {
console.error(`Unknown product ID: ${productId}`);
return {
  softwareProductId: "unknown",
  productName: "Unknown Product",
  planName: "Unknown",
  price: 0
};
}

// Check if plan exists for this product
if (!products[productId].plans[planName]) {
console.error(`Unknown plan ${planName} for product ${productId}`);
return {
  softwareProductId: products[productId].softwareProductId,
  productName: products[productId].name,
  planName: "Unknown",
  price: 0
};
}

const plan = products[productId].plans[planName];

// Get software limit using the updated function that considers both product and plan
const softwareLimit = getSoftwareLimitFromPlan(productId, planName);

return {
softwareProductId: products[productId].softwareProductId, // This is the ACTUAL database product ID
productName: `${products[productId].name} - ${plan.name}`,
planName: plan.name,
price: plan.price,
softwareLimit: softwareLimit
};
}
// Fixed function to properly handle all plan variants
function getSoftwareLimitFromPlan(productId, planName) {
  // Define software limits by product and plan
  // Map lowercase plan identifiers to their corresponding software limits
  const softwareLimits = {
    // Product 1 limits (Airo Web Data Extractor)
    prod1: {
      basic: 20000,
      expert: 70000,
      professional: 200000,
      basicasia: 20000,
      expertasia: 70000,
      professionalasia: 200000,
      test: 1000 // Adding the test plan
    },
    // Product 2 limits (Airo Google Maps Data Extractor)
    
  };

  // First, normalize the input planName to lowercase to handle different case formats
  const normalizedPlanName = planName.toLowerCase();

  // Check if product exists
  if (!softwareLimits[productId]) {
    console.warn(`Unknown product ID: ${productId}, using default limits`);
    // Fallback to product 1 limits
    return softwareLimits.prod1[normalizedPlanName] || 0;
  }

  // Return the corresponding limit using the normalized plan name
  // If the plan doesn't exist in our limits map, return 0
  return softwareLimits[productId][normalizedPlanName] || 0;
}

// Map PayPal status to internal status
function mapPayPalStatusToInternal(paypalStatus) {
const statusMap = {
'APPROVAL_PENDING': 'incomplete',
'APPROVED': 'incomplete',
'ACTIVE': 'active',
'SUSPENDED': 'past_due',
'CANCELLED': 'canceled',
'EXPIRED': 'canceled'
};

return statusMap[paypalStatus] || 'inactive';
}





// Helper function to switch between sandbox and live mode
// You can call this function to switch modes programmatically
function setPayPalMode(sandboxMode = true) {
PAYPAL_SANDBOX_MODE = sandboxMode;
console.log(`PayPal mode set to: ${sandboxMode ? 'SANDBOX' : 'LIVE'}`);
}

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase
      .from("websiteusers")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !data || data.password !== password) {
      return res
        .status(401)
        .send({ success: false, message: "Invalid email or password." });
    }

    // Generate a JWT with email and stripe_customer_id
    console.log(email);
    res.send({
      success: true,
      email: email,
      redirectUrl: "https://web.omnilead.pro/public/dashboard.html",
    });
  } catch (error) {
    console.error("Error validating user:", error);
    res.status(500).send({ success: false, message: "Internal server error." });
  }
});
app.post("/api/change-password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  let mailAccount = req.headers.mailaccount;
  console.log("chage password");
  if (!mailAccount) {
    return res.status(401).json({ error: "Unauthorized. Token is missing." });
  }

  try {
    const email = mailAccount;

    // Fetch user details from Supabase
    const { data: user, error } = await supabase
      .from("websiteusers")
      .select("password") // Only select the password field
      .eq("email", email)
      .single();

    if (error || !user) {
      console.error("Supabase error:", error);
      return res.status(400).json({ error: "User not found." });
    }

    // Compare current password directly
    if (currentPassword !== user.password) {
      return res.status(400).json({ error: "Current password is incorrect." });
    }

    // Update the new password directly (plaintext)
    const { error: updateError } = await supabase
      .from("websiteusers")
      .update({ password: newPassword }) // Save new password as plaintext
      .eq("email", email);

    if (updateError) {
      console.error("Update error:", updateError);
      return res.status(500).json({ error: "Failed to update password." });
    }

    res.json({ message: "Password changed successfully." });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/api/user-details", async (req, res) => {
  let mailAccount = req.headers.mailaccount;
  console.log("mail account is: ", mailAccount);
  if (!mailAccount) {
    return res.status(401).json({ error: "Unauthorized. Token is missing." });
  }

  try {
    const email = mailAccount;
    console.log("mail account is: ", email);

    // Fetch user details from the customers table
    const { data: customer, error } = await supabase
      .from("customers")
      .select("name, email, phone, address")
      .eq("email", email)
      .single();

    if (error || !customer) {
      console.error("Supabase error:", error);
      return res.status(400).json({ error: "User not found." });
    }
    // console.log(customer);

    // Send customer data as JSON response
    res.json(customer);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/api/available-softwares", async (req, res) => {
  let mailAccount = req.headers.mailaccount;

  if (!mailAccount) {
    return res.status(401).json({ error: "Unauthorized. Token is missing." });
  }

  try {
    const email = mailAccount;
    console.log(`Fetching software for user: ${email}`);

    // Fetch the website user record to check for customer IDs
    const { data: websiteUser, error: websiteUserError } = await supabase
      .from("websiteusers")
      .select("stripe_customer_id, paypal_customer_id")
      .eq("email", email)
      .single();

    if (websiteUserError) {
      console.error("User fetch error:", websiteUserError);
      return res.status(400).json({ error: "User not found." });
    }

    // Get customer IDs from both payment platforms
    const stripeCustomerId = websiteUser?.stripe_customer_id;
    const paypalCustomerId = websiteUser?.paypal_customer_id;

    // Store all customer IDs for this user
    const customerIds = [];
    if (stripeCustomerId) customerIds.push(stripeCustomerId);
    if (paypalCustomerId) customerIds.push(paypalCustomerId);

    // Also get PayPal customer IDs from users table as fallback
    const { data: paypalUsers } = await supabase
      .from("users")
      .select("cusid")
      .eq("email", email)
      .eq("payment_platform", "paypal");

    if (paypalUsers && paypalUsers.length > 0) {
      const additionalIds = paypalUsers
        .map((user) => user.cusid)
        .filter((id) => id && !customerIds.includes(id));

      customerIds.push(...additionalIds);
    }

    console.log(`Found ${customerIds.length} customer IDs for this user`);

    // Fetch ALL subscriptions for ALL customer IDs (both Stripe and PayPal)
    let subscriptions = [];

    if (customerIds.length > 0) {
      const { data: allSubscriptions, error: subscriptionError } =
        await supabase
          .from("subscriptions")
          .select("*")
          .in("customer_id", customerIds);

      if (subscriptionError) {
        console.error("Error fetching subscriptions:", subscriptionError);
      } else if (allSubscriptions && allSubscriptions.length > 0) {
        console.log(
          `Found ${allSubscriptions.length} total subscriptions across all customer IDs`
        );
        subscriptions = allSubscriptions;
      }
    }

    // Also check for subscriptions via users table as fallback
    const { data: userRecords } = await supabase
      .from("users")
      .select("subid, product_id")
      .eq("email", email);

    if (userRecords && userRecords.length > 0) {
      const subIds = userRecords
        .map((record) => record.subid)
        .filter((id) => id !== null && id !== undefined);

      if (subIds.length > 0) {
        const { data: additionalSubs, error: addSubError } = await supabase
          .from("subscriptions")
          .select("*")
          .in("id", subIds);

        if (!addSubError && additionalSubs && additionalSubs.length > 0) {
          console.log(
            `Found ${additionalSubs.length} additional subscriptions via user records`
          );

          // Add only subscriptions not already included
          const existingIds = subscriptions.map((sub) => sub.id);
          const newSubs = additionalSubs.filter(
            (sub) => !existingIds.includes(sub.id)
          );

          subscriptions = subscriptions.concat(newSubs);
        }
      }
    }

    console.log(`Total subscriptions found: ${subscriptions.length}`);

    // For debugging, check for multiple subscriptions per product
    const subsByProduct = {};
    subscriptions.forEach((sub) => {
      if (!subsByProduct[sub.product_id]) {
        subsByProduct[sub.product_id] = [];
      }
      subsByProduct[sub.product_id].push(sub);
    });

    // Log products with multiple subscriptions
    Object.keys(subsByProduct).forEach((prodId) => {
      const count = subsByProduct[prodId].length;
      if (count > 1) {
        console.log(`Product ${prodId} has ${count} subscriptions`);
      }
    });

    // If no subscriptions found, return error
    if (subscriptions.length === 0) {
      return res.status(404).json({ error: "No subscriptions found." });
    }

    // Extract unique product IDs from all subscriptions
    const productIds = [...new Set(subscriptions.map((sub) => sub.product_id))];
    console.log(`Found ${productIds.length} unique products`);

    // Fetch software details for all product IDs
    const { data: softwares, error: softwareError } = await supabase
      .from("Softwares Drive")
      .select(
        '"software name", "software description", "software icon", "software drive link", product_id'
      )
      .in("product_id", productIds);

    if (softwareError) {
      console.error("Software fetch error:", softwareError);
      return res.status(404).json({ error: "Error fetching software data." });
    }

    // Create a lookup object for software by product ID
    const softwareByProductId = {};
    if (softwares) {
      softwares.forEach((software) => {
        softwareByProductId[software.product_id] = software;
      });
    }

    // Fetch all licenses for this email
    const { data: licenses, error: licenseError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email);

    if (licenseError) {
      console.error("License fetch error:", licenseError);
      return res
        .status(404)
        .json({ error: "Error fetching license information." });
    }

    console.log(`Found ${licenses ? licenses.length : 0} license records`);

    // Build the final response
    const response = [];

    // Process each product ID
    productIds.forEach((productId) => {
      // Get software details
      const software = softwareByProductId[productId] || {
        "software name": "Unknown Software",
        "software description": "Product information unavailable",
        "software icon": null,
        "software drive link": null,
        product_id: productId,
      };

      // Get all licenses for this product
      const productLicenses = licenses
        ? licenses.filter((lic) => lic.product_id === productId)
        : [];

      // Create the response object for this product
      response.push({
        software,
        licenses: productLicenses,
        email,
      });
    });

    res.json(response);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});
// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Add these dependencies at the top of your file
const cron = require("node-cron");

// Function to update user's subscription details including credit limit and expiry date
async function updateUserSubscriptionDetails(subscription, userDetails) {
  try {
    const currentDate = new Date();
    let expiryDate = null;
    let status = "active";
    let softwareLimit = userDetails.softwarelimit || 0;
    let softwareLimitRemains = userDetails.softwarelimitremains || 0;

    // Set the expiry date based on the subscription's current period end
    if (subscription.current_period_end) {
      expiryDate = new Date(subscription.current_period_end);
    } else if (subscription.status !== "active") {
      // If subscription is not active and no end date is available, set to current date
      expiryDate = currentDate;
      status = "inactive";
    }

    // For expired subscriptions, reset the credit limit based on status
    if (subscription.status !== "active") {
      softwareLimitRemains = 0; // Zero out the remaining credits for inactive subscriptions
    } else if (
      subscription.status === "active" &&
      currentDate > new Date(userDetails.expiry_date)
    ) {
      // If the subscription is active but there was a renewal (current date > old expiry date)
      // Reset the remaining credits to full limit for the new period
      softwareLimitRemains = softwareLimit;
    }

    // Update the user record with new values
    const { error } = await supabase
      .from("users")
      .update({
        expiry_date: expiryDate,
        status: status,
        softwarelimitremains: softwareLimitRemains,
      })
      .eq("subid", subscription.id)
      .eq("email", userDetails.email);

    if (error) {
      console.error(
        `Error updating user subscription details for ${userDetails.email}:`,
        error
      );
      return false;
    }

    console.log(
      `Successfully updated subscription details for user: ${userDetails.email}`
    );
    return true;
  } catch (error) {
    console.error("Error in updateUserSubscriptionDetails:", error);
    return false;
  }
}

// Periodic job to check and update all subscription statuses
async function checkAndUpdateAllSubscriptions() {
  try {
    console.log("Starting subscription status check...");

    // Get all users with subscription IDs
    const { data: usersWithSubs, error: userError } = await supabase
      .from("users")
      .select(
        "email, subid, softwarelimit, softwarelimitremains, expiry_date, status"
      )
      .not("subid", "is", null);

    if (userError) {
      console.error("Error fetching users with subscriptions:", userError);
      return;
    }

    if (!usersWithSubs || usersWithSubs.length === 0) {
      console.log("No users with subscriptions found");
      return;
    }

    console.log(
      `Found ${usersWithSubs.length} users with subscriptions to check`
    );

    // Process each user's subscription
    for (const user of usersWithSubs) {
      try {
        // Get latest subscription data from Stripe
        let subscription;
        try {
          subscription = await stripeInstance.subscriptions.retrieve(
            user.subid
          );
        } catch (stripeError) {
          if (stripeError.code === "resource_missing") {
            console.log(
              `Subscription ${user.subid} no longer exists in Stripe. Marking as inactive.`
            );

            // Update subscription as inactive in our database
            const { error: subUpdateError } = await supabase
              .from("subscriptions")
              .update({
                status: "inactive",
              })
              .eq("id", user.subid);

            if (subUpdateError) {
              console.error(
                `Error marking subscription ${user.subid} as inactive:`,
                subUpdateError
              );
            }

            // Update user details for canceled subscription
            await updateUserSubscriptionDetails(
              {
                id: user.subid,
                status: "inactive",
                current_period_end: null,
              },
              user
            );

            continue; // Skip to next user
          } else {
            console.error(
              `Error fetching subscription ${user.subid} from Stripe:`,
              stripeError
            );
            continue; // Skip to next user on any error
          }
        }

        // Get latest subscription data from our database
        const { data: dbSubscription, error: dbSubError } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("id", user.subid)
          .single();

        if (dbSubError) {
          console.error(
            `Error fetching subscription ${user.subid} from database:`,
            dbSubError
          );
          continue;
        }

        // Update database subscription record with latest Stripe data
        const { error: updateError } = await supabase
          .from("subscriptions")
          .update({
            status: subscription.status,
            current_period_end: new Date(
              subscription.current_period_end * 1000
            ),
          })
          .eq("id", user.subid);

        if (updateError) {
          console.error(
            `Error updating subscription ${user.subid}:`,
            updateError
          );
        }

        // Update user details based on subscription status
        await updateUserSubscriptionDetails(
          {
            id: user.subid,
            status: subscription.status,
            current_period_end: new Date(
              subscription.current_period_end * 1000
            ),
          },
          user
        );
      } catch (error) {
        console.error(
          `Error processing subscription for user ${user.email}:`,
          error
        );
      }
    }

    console.log("Subscription status check completed");
  } catch (error) {
    console.error("Error in checkAndUpdateAllSubscriptions:", error);
  }
}

// Webhook handler for subscription events from Stripe
async function handleStripeWebhookEvent(event) {
  try {
    const eventType = event.type;
    const data = event.data.object;

    // Only process subscription-related events
    if (
      !eventType.startsWith("customer.subscription") &&
      !eventType.startsWith("invoice")
    ) {
      return;
    }

    console.log(`Processing Stripe webhook event: ${eventType}`);

    switch (eventType) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.resumed":
        await handleSubscriptionUpdated(data);
        break;

      case "customer.subscription.deleted":
      case "customer.subscription.paused":
        await handleSubscriptionCancelled(data);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(data);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(data);
        break;
    }
  } catch (error) {
    console.error("Error handling Stripe webhook:", error);
  }
}

// Handle subscription updates (created, updated, resumed)
async function handleSubscriptionUpdated(subscription) {
  try {
    // Update subscription in our database
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000),
      })
      .eq("id", subscription.id);

    if (updateError) {
      console.error(
        `Error updating subscription ${subscription.id}:`,
        updateError
      );
      return;
    }

    // Find users with this subscription
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("subid", subscription.id);

    if (userError || !users || users.length === 0) {
      console.error(
        `Error finding users for subscription ${subscription.id}:`,
        userError
      );
      return;
    }

    // Update each user's subscription details
    for (const user of users) {
      await updateUserSubscriptionDetails(
        {
          id: subscription.id,
          status: subscription.status,
          current_period_end: new Date(subscription.current_period_end * 1000),
        },
        user
      );
    }

    console.log(
      `Successfully processed subscription update for ${subscription.id}`
    );
  } catch (error) {
    console.error("Error in handleSubscriptionUpdated:", error);
  }
}

// Handle subscription cancellation (deleted, paused)
async function handleSubscriptionCancelled(subscription) {
  try {
    // Update subscription in our database
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        status: "inactive",
      })
      .eq("id", subscription.id);

    if (updateError) {
      console.error(
        `Error updating cancelled subscription ${subscription.id}:`,
        updateError
      );
      return;
    }

    // Find users with this subscription
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("subid", subscription.id);

    if (userError || !users || users.length === 0) {
      console.error(
        `Error finding users for cancelled subscription ${subscription.id}:`,
        userError
      );
      return;
    }

    // Update each user's subscription details
    for (const user of users) {
      // For cancelled subscriptions, zero out the remaining credits
      await updateUserSubscriptionDetails(
        {
          id: subscription.id,
          status: "inactive",
          current_period_end: new Date(), // Set to current date for immediate expiry
        },
        user
      );
    }

    console.log(
      `Successfully processed subscription cancellation for ${subscription.id}`
    );
  } catch (error) {
    console.error("Error in handleSubscriptionCancelled:", error);
  }
}

// Handle payment failures
async function handlePaymentFailed(invoice) {
  try {
    if (!invoice.subscription) {
      console.log("Invoice does not have a subscription associated");
      return;
    }

    // Get subscription details
    const subscription = await stripeInstance.subscriptions.retrieve(
      invoice.subscription
    );

    // Check if subscription is past due or unpaid
    if (
      subscription.status === "past_due" ||
      subscription.status === "unpaid"
    ) {
      // Update subscription in our database
      const { error: updateError } = await supabase
        .from("subscriptions")
        .update({
          status: subscription.status,
        })
        .eq("id", subscription.id);

      if (updateError) {
        console.error(
          `Error updating subscription ${subscription.id} status:`,
          updateError
        );
        return;
      }

      // Find users with this subscription
      const { data: users, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("subid", subscription.id);

      if (userError || !users || users.length === 0) {
        console.error(
          `Error finding users for subscription ${subscription.id}:`,
          userError
        );
        return;
      }

      // Update each user's subscription details - zero out remaining credits for past due accounts
      for (const user of users) {
        await updateUserSubscriptionDetails(
          {
            id: subscription.id,
            status: subscription.status,
            current_period_end: new Date(
              subscription.current_period_end * 1000
            ),
          },
          {
            ...user,
            softwarelimitremains: 0, // Zero out the remaining credits for past due subscriptions
          }
        );
      }

      console.log(
        `Successfully processed payment failure for subscription ${subscription.id}`
      );
    }
  } catch (error) {
    console.error("Error in handlePaymentFailed:", error);
  }
}

// Handle successful payments
async function handlePaymentSucceeded(invoice) {
  try {
    if (!invoice.subscription) {
      console.log("Invoice does not have a subscription associated");
      return;
    }

    // Get subscription details
    const subscription = await stripeInstance.subscriptions.retrieve(
      invoice.subscription
    );

    // Update subscription in our database
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000),
      })
      .eq("id", subscription.id);

    if (updateError) {
      console.error(
        `Error updating subscription ${subscription.id} after payment:`,
        updateError
      );
      return;
    }

    // Find users with this subscription
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("subid", subscription.id);

    if (userError || !users || users.length === 0) {
      console.error(
        `Error finding users for subscription ${subscription.id}:`,
        userError
      );
      return;
    }

    // Update each user's subscription details - restore full credit limit on successful payment
    for (const user of users) {
      // For successful payments, reset remaining credits to the full limit
      await updateUserSubscriptionDetails(
        {
          id: subscription.id,
          status: subscription.status,
          current_period_end: new Date(subscription.current_period_end * 1000),
        },
        {
          ...user,
          softwarelimitremains: user.softwarelimit, // Reset to full credit limit
        }
      );
    }

    console.log(
      `Successfully processed payment success for subscription ${subscription.id}`
    );
  } catch (error) {
    console.error("Error in handlePaymentSucceeded:", error);
  }
}

// Set up Stripe webhook endpoint
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      // Verify webhook signature using your Stripe webhook secret
      event = stripeInstance.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
      await handleStripeWebhookEvent(event);
      res.status(200).send("Webhook received successfully");
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).send("Error processing webhook");
    }
  }
);

// Schedule the subscription check to run daily at midnight
cron.schedule("0 0 * * *", async () => {
  console.log("Running scheduled subscription status check...");
  await checkAndUpdateAllSubscriptions();
});

// Also expose an API endpoint to manually trigger the check if needed
app.get("/api/admin/check-subscriptions", async (req, res) => {
  // Add authentication/authorization check here
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await checkAndUpdateAllSubscriptions();
    res.json({ success: true, message: "Subscription check initiated" });
  } catch (error) {
    console.error("Error triggering subscription check:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to check subscriptions" });
  }
});
console.log("PAYPAL_CLIENT_ID:", process.env.PAYPAL_SANDBOX_CLIENT_ID);
console.log("PAYPAL_CLIENT_SECRET:", process.env.PAYPAL_SANDBOX_CLIENT_SECRET);
// // Run an initial check when the server starts
// (async () => {
//   try {
//     console.log('Running initial subscription status check on server startup...');
//     await checkAndUpdateAllSubscriptions();
//   } catch (error) {
//     console.error('Error during initial subscription check:', error);
//   }
// })();
