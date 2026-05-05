\# TODO: Mining Recommender Request Integration



\## Current state



The Mining page can export a formal request payload as:



`mining\_recommender\_request.json`



The frontend does not calculate recommendation scoring. React only packages user intent.



Current active recommender script:



`D:\\scintel\\scripts\\link\\build\_queue\_recommendation\_fixture.py`



Current generated output:



`D:\\scintel\\api\\recommendations\\build\_queue\_recommendation\_fixture.json`



Frontend fixture copy:



`src/data/recommendations/build\_queue\_recommendation\_fixture.json`



\## Goal



Update `build\_queue\_recommendation\_fixture.py` to accept a formal request JSON.



Future command shape:



```powershell

python "D:\\scintel\\scripts\\link\\build\_queue\_recommendation\_fixture.py" `

&#x20; --api-root "D:\\scintel\\api" `

&#x20; --request "D:\\scintel\\api\\recommendations\\mining\_recommender\_request.json" `

&#x20; --output "D:\\scintel\\api\\recommendations\\build\_queue\_recommendation\_fixture.json"

