# @sutysisku/lojban-corpus-downloader


# Generating audio using Amazon Polly

* In AWS dashboard in IAM create user, user groups, add user to the user group
	* create new policy via json editor:
    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "polly:SynthesizeSpeech",
            "polly:StartSpeechSynthesisTask"
          ],
          "Resource": "*"
        }
      ]
    }
    ```
	* attach policy to the user group
* create access key+secret key for the user (for third-party apps)
* add them to `.env` using `.env.example` as a reference