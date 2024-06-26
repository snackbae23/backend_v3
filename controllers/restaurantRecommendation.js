const restaurantDetails = require('../models/restaurantDetails');
const userProfile =  require('../models/userProfile');
const analytics = require('../models/analytics');

const toggleRecommendation =  async(req,res) => {
    try{
        const userId = req.params.userId;
        const restaurantId = req.params.restaurantId;

        const restaurant = await restaurantDetails.findById(restaurantId);

        const indexInRecommendations = restaurant.recommendedBy.indexOf(userId);
        if (indexInRecommendations !== -1) {
            restaurant.recommendedBy.splice(indexInRecommendations, 1);
        } else {
            restaurant.recommendedBy.push(userId);
        }

        const count = restaurant.recommendedBy.length;

        restaurant.recommendationCount = count;

        await restaurant.save();

        const user = await userProfile.findById(userId);

        const indexInUserRecommendations = user.recommendedRestaurants.indexOf(restaurantId);
        if (indexInUserRecommendations !== -1) {
            user.recommendedRestaurants.splice(indexInUserRecommendations, 1);
        } else {
            user.recommendedRestaurants.push(restaurantId);
        }

        await user.save();

        
        //for total and returning customer
        const analytic = new analytics({
            userId,
            // createdAt: "2024-05-12T14:19:14.311+00:00"
        });

        const savedAnalytics = await analytic.save();

        const rest = await restaurantDetails.findById(restaurantId).populate('totalCustomersData').exec();
        if (!rest) {
            return res.status(500).json({ error: "Restaurant details not found" });
        }

        if (rest.totalCustomersData.length > 0) {
            const existingAnalytics = await analytics.find({
                _id: { $in: rest.totalCustomersData }
            });

            const hasDuplicate = existingAnalytics.some(entry =>
                entry.userId.toString() === userId && entry.createdAt.toISOString().slice(0, 10) === savedAnalytics.createdAt.toISOString().slice(0, 10)
            );

            if (!hasDuplicate) {
                rest.totalCustomersData.push(savedAnalytics._id);
                rest.totalCustomers = rest.totalCustomersData.length;
                await rest.save();
            }
        }
        else {
            rest.totalCustomersData.push(savedAnalytics._id);
            rest.totalCustomers = rest.totalCustomersData.length;
            await rest.save();
        }

        if (!Array.isArray(rest.returningCustomerData)) {
            rest.returningCustomerData = [];
        }

        const x = rest.returningCustomerData.includes(userId);
        if (!x)
        {
            //check krna hai ki vo user id present hai ki nahi totalCustomerData mein
            const match = rest.totalCustomersData.find(analyticsEntry => {
                if(analyticsEntry.userId === userId)
                {
                    if(analyticsEntry.createdAt.toISOString().slice(0, 10) === savedAnalytics.createdAt.toISOString().slice(0, 10))
                    {
                        return false;
                    }
                    return true;
                }
                return false;
                // return analyticsEntry.userId === userId && analyticsEntry.createdAt.toISOString().slice(0, 10) != savedAnalytics.createdAt.toISOString().slice(0, 10);
            });

            //if present
            if (!match) {
                rest.returningCustomerData.push(userId);
                rest.returningCustomer = rest.returningCustomerData.length;
                await rest.save();
            }
        }


        res.status(200).json({ message: "Recommendation toggled successfully" });

    } catch(error) {
        console.error("Error toggling recommendation:", error);
        res.status(500).json({ 
            error: "Internal server error" 
        });
    }
};

module.exports = {toggleRecommendation};