const { handler } = require('./index');

const manualTrigger = async (action) => {
  try {
    // Mock Lambda context
    const context = {
      callbackWaitsForEmptyEventLoop: false,
      on: () => {}
    };

    // Different event configurations based on action
    const events = {
      generate: { forceGenerate: true },
      post: { manualPost: true },
      both: { forceGenerate: true, manualPost: true }
    };

    const event = events[action] || events.both;
    
    console.log(`Manual trigger initiated with action: ${action}`);
    const result = await handler(event, context);
    console.log('Manual trigger result:', result);
    return result;
  } catch (error) {
    console.error('Manual trigger failed:', error);
    throw error;
  }
};

// Execute if run directly
if (require.main === module) {
  const action = process.argv[2] || 'both';
  manualTrigger(action)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = manualTrigger;
