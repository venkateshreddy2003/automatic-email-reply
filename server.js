const express = require("express");
const { google } = require("googleapis");
const { OAuth2 } = google.auth;
const nodemailer = require("nodemailer");
require("dotenv").config();
const app = express();
// Auth details for creating a oauth2 client
const getRndInteger = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};
const oAuth2Client = new OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);
oAuth2Client.setCredentials({
  refresh_token: process.env.REFRESH_TOKEN,
});
// creating a new instance of the Gmail API client using the googleapis package.
// It sets the version to "v1" and specifies the oAuth2Client object as the authentication mechanism.
const gmail = google.gmail({
  version: "v1",
  auth: oAuth2Client,
});
// This function identifies the unread messages in the mail box and and gets them and verify it is a thread and we have not replied to it previously
// Then only the function replies with the message "Sent Using node js using google apis for gmail iam in vacation"
const emailReply = () => {
  // get message details
  // The userId parameter is set to "me" to indicate that the authenticated user's mailbox is being queried,
  // and the q parameter is set to "is:unread" to filter
  // the list to only show unread messages.
  gmail.users.messages.list(
    {
      userId: "me",
      q: `is:unread`,
    },
    async (err, res) => {
      if (err) {
        console.log("error: " + err);
        return;
      }
      // getb the messages from the response
      const messages = res.data.messages;
      // it works when there is a new unread message
      if (messages?.length) {
        console.log("New message are there");

        //checking if message unread
        for (const message of messages) {
          const messageDetails = await gmail.users.messages.get({
            userId: "me",
            id: message.id,
          });
          // console.log(messageDetails);
          const threadId = messageDetails.data.threadId;
          // getting details of thread using the message id
          const threadDetails = await gmail.users.threads.get({
            userId: "me",
            id: threadId,
          });
          // console.log(threadDetails);
          // if we had not send any mail then it works and checks whether SENT label is in the message
          // because if it is present then we have already replied
          if (
            !threadDetails.data.messages.some((msg) =>
              msg.payload.headers.find(
                (header) =>
                  header.name === "From" &&
                  header.value.includes("bloguser.2003@gmail.com")
              )
            )
          ) {
            console.log(
              `New email thread with subject "${
                messageDetails.data.payload.headers.find(
                  (header) => header.name === "Subject"
                ).value
              }" and thread ID ${threadId} received!`
            );

            // Sending a response to new unread Threads
            const transporter = nodemailer.createTransport({
              service: "gmail",
              auth: {
                type: "OAuth2",
                user: "bloguser.2003@gmail.com",
                clientId: process.env.CLIENT_ID,
                clientSecret: process.env.CLIENT_SECRET,
                refreshToken: process.env.REFRESH_TOKEN,
                accessToken: oAuth2Client.getAccessToken(),
              },
            });
            const fromMail = messageDetails.data.payload.headers.find(
              (header) => header.name === "From"
            ).value;
            const mailOptions = {
              from: "bloguser.2003@gmail.com",
              to: fromMail,
              subject:
                "Re: " +
                messageDetails.data.payload.headers.find(
                  (header) => header.name === "Subject"
                ).value,
              text: "Sent Using node js and google apis for gmail iam in vacation i will message you again when iam available",
            };
            // sending the mail using nodemailer
            transporter.sendMail(mailOptions, async (err, info) => {
              if (err) {
                console.log(err);
              } else {
                console.log(
                  `Automatic response sent to ${fromMail}: ${info.response}`
                );
                const labelName = "automatic-replying";

                // Check if label exists
                let label = null;
                let labels = [];
                let labelFound = false;
                gmail.users.labels
                  .list({
                    userId: "me",
                  })
                  .then((res) => {
                    console.log("LABELS FETCHED");
                    labels = res.data.labels;
                    labels.forEach((l) => {
                      if (l.name === labelName) {
                        console.log(`"${labelName}" label already exists`);
                        label = l;
                        labelFound = true;
                      }
                    });
                    // if label does not exists create new one
                    if (!labelFound) {
                      gmail.users.labels
                        .create({
                          userId: "me",
                          requestBody: {
                            name: labelName,
                            labelListVisibility: "labelShow",
                            messageListVisibility: "show",
                          },
                        })
                        .then((res) => {
                          console.log(`"${labelName}" label created`, res);
                          // adding message to the label
                          gmail.users.threads
                            .modify({
                              userId: "me",
                              id: threadId,
                              resource: {
                                addLabelIds: [label.id],
                                removeLabelIds: ["UNREAD"],
                              },
                            })
                            .then((res) => {
                              console.log(`"automatic-replying" label added`);
                            })
                            .catch((err) => {
                              console.log("couldn't add label", err);
                            });
                        })
                        .catch((err) => {
                          console.log("CREATING LABEL ERROR", err);
                        });
                    } else {
                      gmail.users.threads
                        .modify({
                          userId: "me",
                          id: threadId,
                          resource: {
                            addLabelIds: [label.id],
                            removeLabelIds: ["UNREAD"],
                          },
                        })
                        .then((res) => {
                          console.log(`"automatic-replying" label added`);
                        })
                        .catch((err) => {
                          console.log("couldn't add label", err);
                        });
                    }
                  })
                  .catch((err) => {
                    console.log("ERROR WITH LABELS", err);
                  });
              }
            });
          }
          // email threads that has our previous reply
          else {
            console.log(
              `Email thread with thread ID ${threadId} already has a reply from you.`
            );
            gmail.users.threads
              .modify({
                userId: "me",
                id: threadId,
                resource: {
                  removeLabelIds: ["UNREAD"],
                },
              })
              .then((res) => {
                console.log(
                  `un read label removed for threads which has already reply from you`,
                  res
                );
              })
              .catch((err) => {
                console.log("couldn't remove unread label", err);
              });
          }
        }
      } else {
        console.log("No new messages.");
      }
    }
  );
};

//interval of the function call
const randomNumber = getRndInteger(45, 120);
console.log("Random interval is " + " " + randomNumber);
setInterval(emailReply, 5 * 1000);

app.listen(process.env.PORT, () => {
  console.log("listening on port " + process.env.PORT);
});
