const { TwitterApi } = require('twitter-api-v2');
const OpenAI = require('openai');
const fs = require('fs');

const twitter = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const categories = ['POEM', 'MOTIVATIONAL', 'JOKE', 'INSPIRATIONAL', 'GEETA'];
const prompts = {
  POEM: "Write a short, emotional poem or Hindi shayari about love, life, or struggle in under 280 characters.",
  MOTIVATIONAL: "Create an original, powerful motivational quote under 280 characters.",
  JOKE: "Create a clever, witty joke or wordplay that's fun and non-offensive in under 280 characters.",
  INSPIRATIONAL: "Generate an original inspirational quote about personal growth in under 280 characters.",
  GEETA: "Provide a concise insight from the Bhagavad Gita that encapsulates wisdom about life, ensuring it fits within 280 characters."
};

// Add Twitter client verification
const verifyTwitterCredentials = async () => {
  try {
    const result = await twitter.v2.me();
    console.log('Twitter credentials verified:', result.data);
    return true;
  } catch (error) {
    console.error('Twitter credentials verification failed:', error);
    return false;
  }
};

// Add utility function for IST time conversion
const getISTTime = (date) => {
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(date.getTime() + istOffset);
};

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  try {
    const isTwitterValid = await verifyTwitterCredentials();
    if (!isTwitterValid) {
      throw new Error('Twitter credentials are invalid');
    }

    const now = new Date();
    const istTime = getISTTime(now);
    const currentHour = istTime.getHours();
    const currentMinute = istTime.getMinutes();

    console.log(`Current IST time: ${istTime.toISOString()}, Hour: ${currentHour}, Minute: ${currentMinute}`);

    // Read existing tweets.json
    const tweetsFilePath = './tweets.json';
    let tweetsData = JSON.parse(fs.readFileSync(tweetsFilePath, 'utf-8'));

    // Check if it's generation time (9:30 AM IST) or forced generation
    if (event.forceGenerate || (currentHour === 9 && currentMinute === 30)) {
      console.log('Generating new tweets for today...');
      const tweets = [];
      const shuffledCategories = [...categories, ...categories].sort(() => Math.random() - 0.5);
      
      // Generate tweets for today
      for (let i = 0; i < 10; i++) {
        const hour = i < 5 ? 10 + i : 17 + (i - 5);
        const minute = Math.floor(Math.random() * 60);
        const tweetTime = new Date(istTime);
        tweetTime.setHours(hour, minute, 0, 0);
        
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompts[shuffledCategories[i]] }],
        });

        tweets.push({
          category: shuffledCategories[i],
          content: response.choices[0].message.content,
          scheduledTime: tweetTime.toISOString()
        });
      }

      // Save new schedule
      tweetsData = {
        scheduledTweets: tweets,
        lastUpdated: now.toISOString()
      };
      fs.writeFileSync(tweetsFilePath, JSON.stringify(tweetsData, null, 2));
      
      return { status: 'Tweets generated and scheduled' };
    }

    // Check for tweets that need to be posted
    const tweetsDue = tweetsData.scheduledTweets.filter(tweet => {
      const scheduledTime = new Date(tweet.scheduledTime);
      const scheduledIST = getISTTime(scheduledTime);
      return scheduledIST.getHours() === currentHour && 
             scheduledIST.getMinutes() === currentMinute;
    });

    if (tweetsDue.length > 0 || event.manualPost) {
      const tweetsToPost = event.manualPost ? 
        [tweetsData.scheduledTweets[0]] : 
        tweetsDue;

      for (const tweet of tweetsToPost) {
        const postedTweet = await twitter.v2.tweet(tweet.content);
        console.log(`Posted ${tweet.category} tweet:`, postedTweet.data);
        
        // Remove posted tweet from schedule
        tweetsData.scheduledTweets = tweetsData.scheduledTweets.filter(t => 
          t.scheduledTime !== tweet.scheduledTime
        );
      }

      // Update tweets.json
      fs.writeFileSync(tweetsFilePath, JSON.stringify(tweetsData, null, 2));
      
      return { 
        status: 'Success', 
        tweetsPosted: tweetsToPost.length,
        remainingTweets: tweetsData.scheduledTweets.length
      };
    }

    return { 
      status: 'No action needed',
      remainingTweets: tweetsData.scheduledTweets.length
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
