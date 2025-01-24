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
    // Get current time in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istTime = new Date(now.getTime() + istOffset);
    const currentHour = istTime.getHours();
    const currentMinute = istTime.getMinutes();

    console.log(`Current IST time: ${istTime.toISOString()}, Hour: ${currentHour}, Minute: ${currentMinute}`);

    // Generate tweets at 9:30 AM IST
    if (currentHour === 9 && currentMinute === 30) {
      console.log('Starting tweet generation for today...');
      const tweets = [];
      const shuffledCategories = [...categories, ...categories].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < 10; i++) {
        const hour = i < 5 ? 9 + i : 17 + (i - 5);
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompts[shuffledCategories[i]] }],
        });

        tweets.push({
          category: shuffledCategories[i],
          content: response.choices[0].message.content,
          scheduledTime: new Date(now.setHours(hour, Math.floor(Math.random() * 60), 0, 0))
        });
      }

      await fs.writeFileSync('/tmp/tweets.json', JSON.stringify({ 
        scheduledTweets: tweets,
        lastUpdated: now.toISOString()
      }));

      return { status: 'Tweets generated' };
    }

    // Post scheduled tweets
    try {
      // Check if tweets.json exists
      if (fs.existsSync('/tmp/tweets.json')) {
        const tweetsData = JSON.parse(fs.readFileSync('/tmp/tweets.json', 'utf-8'));
        const tweetsDue = tweetsData.scheduledTweets.filter(tweet => {
          const scheduledTime = new Date(tweet.scheduledTime);
          return scheduledTime.getHours() === currentHour && 
                 scheduledTime.getMinutes() === currentMinute;
        });

        // Post due tweets
        for (const tweet of tweetsDue) {
          await twitter.v2.tweet(tweet.content);
          console.log(`Posted ${tweet.category} tweet`);
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
