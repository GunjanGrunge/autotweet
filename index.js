const { TwitterApi } = require('twitter-api-v2');
const OpenAI = require('openai');
const fs = require('fs');

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

// Add debug logging for environment variables
const debugEnvVars = () => {
  console.log('Checking environment variables:');
  const vars = [
    'TWITTER_API_KEY',
    'TWITTER_API_SECRET',
    'TWITTER_ACCESS_TOKEN',
    'TWITTER_ACCESS_SECRET'
  ];
  
  vars.forEach(v => {
    console.log(`${v}: ${process.env[v] ? 'Present' : 'Missing'}`);
    if (process.env[v]) {
      console.log(`${v} length: ${process.env[v].length}`);
    }
  });
};

// Add Twitter client debug logging
const logTwitterConfig = () => {
  const credentials = {
    apiKey: process.env.TWITTER_API_KEY?.length ?? 'missing',
    apiSecret: process.env.TWITTER_API_SECRET?.length ?? 'missing',
    accessToken: process.env.TWITTER_ACCESS_TOKEN?.length ?? 'missing',
    accessSecret: process.env.TWITTER_ACCESS_SECRET?.length ?? 'missing'
  };
  console.log('Twitter Credentials Status:', credentials);
};

// Initialize Twitter client with error handling
const initializeTwitterClient = () => {
  try {
    console.log('Initializing Twitter client...');
    logTwitterConfig();
    
    if (!process.env.TWITTER_API_KEY || 
        !process.env.TWITTER_API_SECRET || 
        !process.env.TWITTER_ACCESS_TOKEN || 
        !process.env.TWITTER_ACCESS_SECRET) {
      throw new Error('Missing Twitter credentials');
    }

    return new TwitterApi({
      appKey: process.env.TWITTER_API_KEY.trim(),
      appSecret: process.env.TWITTER_API_SECRET.trim(),
      accessToken: process.env.TWITTER_ACCESS_TOKEN.trim(),
      accessSecret: process.env.TWITTER_ACCESS_SECRET.trim(),
    });
  } catch (error) {
    console.error('Twitter client initialization error:', error);
    throw error;
  }
};

// Modify Twitter client verification
const verifyTwitterCredentials = async (twitter) => {
  try {
    console.log('Initializing Twitter client...');
    debugEnvVars();
    
    // Log Twitter client configuration (safely)
    console.log('Twitter client config:', {
      hasAppKey: !!twitter.appKey,
      hasAppSecret: !!twitter.appSecret,
      hasAccessToken: !!twitter.accessToken,
      hasAccessSecret: !!twitter.accessSecret
    });

    const result = await twitter.v2.me();
    console.log('Twitter credentials verified successfully:', result.data);
    return true;
  } catch (error) {
    console.error('Twitter verification error details:', {
      message: error.message,
      code: error.code,
      data: error.data,
      stack: error.stack
    });
    return false;
  }
};

// Add utility function for IST time conversion
const getISTTime = (date) => {
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(date.getTime() + istOffset);
};

// Modify the handler's error handling
exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  try {
    console.log('Lambda function started');
    console.log('Event:', JSON.stringify(event));
    
    // Initialize Twitter client inside handler
    const twitter = initializeTwitterClient();
    
    const isTwitterValid = await verifyTwitterCredentials(twitter);
    if (!isTwitterValid) {
      console.error('Twitter credentials validation failed');
      throw new Error('Twitter credentials validation failed. Check logs for details.');
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
