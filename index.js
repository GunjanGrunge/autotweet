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
  // Enable AWS Lambda context callbackWaitsForEmptyEventLoop
  context.callbackWaitsForEmptyEventLoop = false;
  
  // Define cleanup function at handler scope
  const cleanup = async () => {
    try {
      await openai.closeConnection?.();
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
  };

  try {
    // Verify Twitter credentials first
    const isTwitterValid = await verifyTwitterCredentials();
    if (!isTwitterValid) {
      throw new Error('Twitter credentials are invalid');
    }

    // Get current time in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istTime = new Date(now.getTime() + istOffset);
    const currentHour = istTime.getHours();
    const currentMinute = istTime.getMinutes();

    console.log(`Current IST time: ${istTime.toISOString()}, Hour: ${currentHour}, Minute: ${currentMinute}`);

    // Check for force generate flag or regular schedule
    if (event.forceGenerate || (currentHour === 9 && currentMinute >= 30 && currentMinute <= 32)) {
      console.log('Starting tweet generation for today at 9:30 AM IST...');
      const tweets = [];
      const shuffledCategories = [...categories, ...categories].sort(() => Math.random() - 0.5);
      
      // Adjust scheduling to use IST times
      for (let i = 0; i < 10; i++) {
        const hour = i < 5 ? 10 + i : 17 + (i - 5); // Start from 10 AM IST
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

        console.log(`Scheduled ${shuffledCategories[i]} tweet for ${tweetTime.toISOString()}`);
      }

      // Enhanced logging with IST times
      console.log('Generated tweets schedule (IST):');
      tweets.forEach(tweet => {
        const istScheduledTime = getISTTime(new Date(tweet.scheduledTime));
        console.log(`${tweet.category}: ${istScheduledTime.toLocaleTimeString('en-IN')} IST`);
      });

      // Add debug logging for generated tweets
      console.log('Generated tweets:', tweets.map(t => ({
        category: t.category,
        scheduledTime: t.scheduledTime
      })));

      await fs.writeFileSync('/tmp/tweets.json', JSON.stringify({ 
        scheduledTweets: tweets,
        lastUpdated: now.toISOString()
      }));

      return { status: 'Tweets generated' };
    }

    // Post scheduled tweets with IST time comparison
    try {
      // Check if tweets.json exists
      if (fs.existsSync('/tmp/tweets.json')) {
        const tweetsData = JSON.parse(fs.readFileSync('/tmp/tweets.json', 'utf-8'));
        const tweetsDue = tweetsData.scheduledTweets.filter(tweet => {
          const scheduledTime = new Date(tweet.scheduledTime);
          const scheduledIST = new Date(scheduledTime.getTime() + istOffset);
          return scheduledIST.getHours() === currentHour && 
                 scheduledIST.getMinutes() === currentMinute;
        });

        console.log(`Found ${tweetsDue.length} tweets to post at ${currentHour}:${currentMinute} IST`);

        // Add debug logging for tweets due
        console.log('Found tweets due:', tweetsDue.map(t => ({
          category: t.category,
          content: t.content.substring(0, 30) + '...',
          scheduledTime: t.scheduledTime
        })));

        // Post due tweets
        for (const tweet of tweetsDue) {
          try {
            const postedTweet = await twitter.v2.tweet(tweet.content);
            console.log(`Successfully posted ${tweet.category} tweet:`, postedTweet.data);
          } catch (tweetError) {
            console.error(`Failed to post ${tweet.category} tweet:`, tweetError);
            throw tweetError;
          }
        }

        // Check if this was the last tweet of the day
        const remainingTweets = tweetsData.scheduledTweets.filter(tweet => {
          const scheduledTime = new Date(tweet.scheduledTime);
          const now = new Date();
          return scheduledTime > now;
        });

        if (remainingTweets.length === 0) {
          console.log('All tweets for today completed. Cleaning up...');
          // Delete the tweets.json file
          fs.unlinkSync('/tmp/tweets.json');
          console.log('Cleaned up tweets.json. Ready for next day at 9 AM.');
        }

        return { 
          status: 'Success', 
          tweetsPosted: tweetsDue.length,
          remainingTweets: remainingTweets.length 
        };
      } else {
        console.log('No tweets.json file found. Waiting for 9 AM to generate tweets.');
        return { status: 'Success', message: 'No tweets scheduled yet' };
      }
    } catch (fileError) {
      console.error('Error reading or processing tweets:', fileError);
      return { status: 'Error', message: 'Failed to process scheduled tweets' };
    }

    // Ensure cleanup runs before Lambda ends
    context.on('beforeExit', cleanup);

    const result = { status: 'Success', tweetsPosted: tweetsDue.length };
    await cleanup();
    return result;
  } catch (error) {
    console.error('Error:', error);
    await cleanup();
    throw error; // Re-throw to maintain Lambda error handling
  }
};
