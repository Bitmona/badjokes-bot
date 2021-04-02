import 'source-map-support/register'
//import * as fs from 'fs';
import Twit from 'twit';
//const Twit = require('twit');
import Pino from 'pino';
import axios from 'axios';
import moment from 'moment';

export type Logo = {
    joke: string,
    id: string
};

async function getClient(logger:Pino.Logger):Promise<any> {
    const twitterClient = new Twit({
        consumer_key: process.env.TWITTER_CONSUMER_KEY || '',
        consumer_secret: process.env.TWITTER_CONSUMER_SECRET || '',
        access_token: process.env.TWITTER_ACCESS_TOKEN,
        access_token_secret: process.env.TWITTER_ACCESS_SECRET,
        timeout_ms: 60 * 1000,  // optional HTTP request timeout to apply to all requests.
        strictSSL: true,     // optional - requires SSL certificates to be valid.
    });

    const user = await twitterClient.get('account/verify_credentials')
    logger.debug({ apiResponse: user }, "verify_credentials result");

    return twitterClient;
}

async function getLastTimestamp(logger:Pino.Logger): Promise<moment.Moment> {
    const twitterClient = await getClient(logger);
    const timelineResponse = await twitterClient.get('statuses/user_timeline', {
        count: 10,
        exclude_replies: true,
        screen_name: "BadJokesZone",
        trim_user: true,
        tweet_mode: 'extended'
    });

    if (!timelineResponse.data || timelineResponse.data.length === 0) {
        const err = new Error('No tweets in timeline');
        logger.error( { apiResponse: timelineResponse, err }, "Unable to get most recent tweet");
        throw err;
    }

    logger.debug({ tweet: timelineResponse.data[0] }, 'most recent tweet');

    const timestamp = moment(timelineResponse.data[0].created_at, 'dd MMM DD HH:mm:ss ZZ YYYY', 'en');

    return timestamp;
}

async function getRecent(logger:Pino.Logger): Promise<string[]> {
    const retVal:string[] = [];
    const twitterClient = await getClient(logger);
    const timelineResponse = await twitterClient.get('statuses/user_timeline', {
            count: 25,
            exclude_replies: true,
            screen_name: "BadJokesZone",
            trim_user: true,
            tweet_mode: 'extended'
        });


    logger.trace({ apiResponse: timelineResponse }, 'timeline response');

    for (const tweet of timelineResponse.data) {
        logger.trace({ created: tweet.created_at, urls: tweet.entities.urls.map((x: any) => x.display_url) }, 'historical tweet');
        for (const url of tweet.entities.urls) {
            if (url.display_url.startsWith("vlz.one/")) {
                retVal.push(url.display_url.slice(8));
            }
        }
    }
    retVal.sort()
    logger.debug( { handles: retVal }, "recently tweeted logos")

    return retVal;
}

async function findRandomNotRecent(logger:Pino.Logger, recent:string[]): Promise<Logo> {

    for (var x = 0; x < 100; x++) {
        const jokeResponse = await axios.get('https://badjokes.zone/jokes.json');
        const jokeList = jokeResponse.data.jokes
        logger.debug({ resp: jokeResponse }, 'joke response');
        const ranval = jokeList[Math.floor(Math.random() * (jokeList.length + 1))]
        if (!recent.find(x => x == jokeList[ranval].joke)) {
            return {
                joke: jokeList[ranval].joke,
                id: jokeList[ranval].id
            }
        }
        logger.info({ recent, logo: jokeList[ranval].joke}, "guessed a recent joke");
    }
    throw new Error("No unused jokes!?!?")
}

async function tweet(logger:Pino.Logger, logo:Logo) {

    if (!process.env.TWITTER_CONSUMER_KEY || !process.env.TWITTER_CONSUMER_SECRET) {
        throw new Error('you must set TWITTER_CONSUMER_KEY and TWITTER_CONSUMER_SECRET');
    }


    const twitterClient = await getClient(logger);

    
     //plain tweet
    const tweetResponse = twitterClient.post('statuses/update', {
        status: `${logo.joke}`,
        source: 'badjokes-bot',
        trim_user: true
        //source: '<a href="https://github.com/VectorLogoZone/vlz-bot">VLZ Bot</a>',
    });
    logger.debug({ apiResponse: tweetResponse }, 'simple tweet response');
   

    // pick a random logo
    // LATER: confirm it isn't in the last N tweets (articleTweetExists in https://github.com/danielelkington/twitter-vue-dev/blob/master/AutoTweetDevArticles/tweet.ts)
    // download svg
    // convert to png
/*
    //var b64content = fs.readFileSync('./test.png', { encoding: 'base64' })
    var b64content = Buffer.from(imgResponse.data, 'binary').toString('base64');

    logger.debug({
        base64length: b64content.length,
        base64content: b64content
    }, "image converted to base64");
*/
    // post the media to Twitter
    /*const uploadResponse = await twitterClient.post('media/upload', {
        media_data: b64content
    });
    logger.debug({ apiResponse: uploadResponse }, 'upload response');
*/
    // update its metadata
  /*  const mediaIdStr = uploadResponse.data.media_id_string;
    const metadataResponse = await twitterClient.post('media/metadata/create', {
        media_id: uploadResponse.data.media_id_string,
        alt_text: { text: `PNG Preview of the SVG logo for ${logo.name}` }
    });
    logger.debug({ apiResponse: metadataResponse }, 'metadata/create response');

    // post the tweet
    const postResult = await twitterClient.post('statuses/update', {
        status: `${logo.name} vector (SVG) logos.  Check them out at https://vlz.one/${logo.handle}`,
        media_ids: [mediaIdStr],
        source: 'vlz-bot',
        trim_user: true
    });
    logger.debug({ apiResponse: postResult }, 'update response'); */
/*
    // delete the tweet
    const deleteResult = twitterClient.post('statuses/destroy/:id', {
        id: postResult.id_str
    });
    logger.debug({ apiResponse: deleteResult }, 'destroy response');
*/
}

export {
    findRandomNotRecent,
    getLastTimestamp,
    getRecent,
    tweet
}
