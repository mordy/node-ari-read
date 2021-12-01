//initialize with the channel and the ari you pull from node-ari
module.exports = (channel, ari) => {
    //the reader returns an async function for us to reuse
    return async (props) => {
        const {
            soundFiles,
            digitsInResponse = 0,
            attempts = 3,
            timeout = 10,
            responseValidCallback = false,
            debug = false
        } = props;

        //promise keeps the loop running until we finish it. 
        const value = await new Promise(async (resolve, reject) => {
            let state = {
                soundFileIndex: 0, //which file we are reading
                dontPlayNextFile: false, //tell the reader to stop reading
                isFinished: false, //read is finished
                isPlaying: false, //we are in the middle of a read
                playback: ari.Playback(), //playback channel
                timeout: false, //idle timeout
                playbackFinishedListener: false, //the function that runs when playback is done
            };

            const endCall = (rejectReason) => {
                readIsFinished();
                ari.removeListener('PlaybackFinished', runPlayFinishListener)
                channel.removeListener('StasisEnd', handleHangupDuringRead);
                channel.hangup();
                reject(rejectReason);
            }
            const done = (returnVal = false) => {
                readIsFinished();
                ari.removeListener('PlaybackFinished', runPlayFinishListener);
                channel.removeListener('StasisEnd', handleHangupDuringRead);
                resolve(returnVal);
            }
            const hangupForTooManyAttempts = async () => {
                //wait 1 second
                await new Promise(res => setTimeout(() => res(), 100));
                //after all the attempts we have no selection
                const attemptLimitFinished = () => {
                    debug && console.log('running attemptLimitFinished');
                    endCall('attempt limit');
                };
                setPlayFinishListener(attemptLimitFinished);

                channel.play({ media: 'sound:goodbye' }, state.playback, function (err) { });
            }

            /******************************
             * IDLE HANDLER WHEN THEY STOP PAYING ATTENTION
             *******************************/
            const waitForInactivity = () => {
                clearTimeout(state.timeout);
                state.timeout = null;
                state.timeout = setTimeout(
                    () => {
                        if (state.isFinished) return;
                        debug && console.log('Channel %s stopped paying attention...', text);
                        const timeoutReadLimit = () => {
                            //removeFinishListener();
                            endCall('timeout limit');
                        };
                        setPlayFinishListener(timeoutReadLimit);
                        channel.play({ media: 'sound:goodbye' }, state.playback, function (err) { });


                    }, (timeout || 10) * 1000
                )
            }
            const disableInactivity = () => {
                clearTimeout(state.timeout);
                state.timeout = null;
            }

            //if hangup happens during the read function.
            const handleHangupDuringRead = (event, incoming) => {
                //if this has already 
                if (!state.isFinished) {
                    state.isPlaying = false;
                    ari.removeListener('PlaybackFinished', runPlayFinishListener);
                    readIsFinished()
                }
            }
            channel.on('StasisEnd', handleHangupDuringRead);

            //each time a file playback completes it needs to call this function to do the next actin.
            const setPlayFinishListener = (listener) => {
                state.playbackFinishedListener = listener;
            }
            const runPlayFinishListener = () => {
                if (state.playbackFinishedListener !== false) {
                    state.playbackFinishedListener()
                }
            }
            state.playback.on('PlaybackFinished', runPlayFinishListener);

            //read is completed
            const readIsFinished = () => {
                state.isFinished = true;
                //stop the timer
                disableInactivity();
                //stop the playback from looping
                state.dontPlayNextFile = true;
                if (state.playback && state.isPlaying) {
                    state.playback.stop({ playbackId: state.playback.id }, function (err) {
                        //ignore the error
                        state.isPlaying = false;
                    });
                }
            }

            /**************************************************
             * PLAY FILES FROM BEGINNING TO END             
             *************************************************/
            const playNextFile = () => {
                if (state.dontPlayNextFile) return;

                //get filename, remove the extension as asterisk doesnt need that.
                const filename_no_ext = soundFiles[state.soundFileIndex] && soundFiles[state.soundFileIndex].split('.').length > 1
                    ? soundFiles[state.soundFileIndex].split('.').slice(0, -1).join('.')
                    : soundFiles[state.soundFileIndex];
                state.soundFileIndex++;

                const playComplete = async () => {
                    if (!state.isFinished) {
                        state.isPlaying = false;
                        //LAST FILE
                        if (state.soundFileIndex >= soundFiles.length) {
                            if (digitsInResponse == 0) {
                                done();
                            }
                            else {
                                state.dontPlayNextFile = true;
                                waitForInactivity();
                            }
                        }
                        //GO TO NEXT FILE
                        else {
                            await new Promise(res => setTimeout(() => res(), 20));
                            playNextFile();
                        }
                    }
                }
                setPlayFinishListener(playComplete);
                channel.play({ media: `sound:${filename_no_ext}` }, state.playback, function (err) {/*ignore errors*/ });
                state.isPlaying = true;
            }

            /******************************************
             * GET A SPECIFIC NUMBER OF DIGITS          
             ***************************************/
            const waitForNDigits = async (numDigits) => {
                let selection = await new Promise((resolveSelection) => {
                    const digitsPressed = [];
                    const digitHandler = (event, channel) => {

                        // special for '#' response
                        if (event.digit === '#') {
                            readIsFinished();
                            channel.removeListener('ChannelDtmfReceived', digitHandler);
                            return resolveSelection('#');
                        }

                        //ADD TO LIST OF DIGIS
                        digitsPressed.push(event.digit);
                        waitForInactivity();

                        //IF WE HAVE ENOUGH DIGITS 
                        if (digitsPressed.length >= numDigits) {
                            const numSelected = digitsPressed.join('');
                            readIsFinished();
                            channel.removeListener('ChannelDtmfReceived', digitHandler);
                            return resolveSelection(numSelected);
                        }
                    }
                    channel.on('ChannelDtmfReceived', digitHandler);
                });
                return selection;
            }

            /*****************************************************************************
             * GET A SPECIFIC NUMBER OF VALID DIGITS BY THE ATTEMPT LIMIT  
             ******************************************************************************/
            const getDigitsToRespond = async (attempts, digitsInResponse) => {
                let attemptCount = 0;
                let digitsToReturn = false;
                let ret = await new Promise(async (resolveSelection, rejectSelection) => {
                    while (attemptCount <= attempts && digitsToReturn === false) {
                        //start playing files
                        playNextFile();

                        //listen for the selection.
                        let selection = await waitForNDigits(digitsInResponse);

                        //no valid checker
                        if (typeof responseValidCallback !== 'function') return resolveSelection(selection);

                        //check the selection is valid.
                        if (responseValidCallback(selection)) return resolveSelection(selection);

                        //too many tries, return false
                        if (attemptCount++ > attempts) return resolveSelection(false);

                        //lets try again.
                        debug && console.log(`attempt ${attemptCount} of ${attempts} hit ...`);

                        //wait 1 second so the other file finishes.
                        await new Promise(res => setTimeout(() => res(), 100));

                        //move the read index to the beginning
                        state.soundFileIndex = 0;

                        //reset the finished flags
                        state.dontPlayNextFile = false;
                        state.isFinished = false;

                        //the first thing to read is "this option is invalid"
                        if (soundFiles[0] != 'option-is-invalid') {
                            soundFiles.unshift('option-is-invalid');
                        }

                        //now it will start playing again at top of while loop
                    }
                    return resolveSelection(false);
                });
                return ret;
            }


            /**************************
             * ACTUAL READ       
             **************************/
            if (digitsInResponse > 0) {
                let digitsToReturn = await getDigitsToRespond(attempts, digitsInResponse);
                if (digitsToReturn === false) {
                    await hangupForTooManyAttempts();
                }
                else {
                    done(digitsToReturn);
                }
            }
            else {
                playNextFile();
            }
        });

        //now once the promise resolves we return it.
        return value;
    }
}