\# TODO: Mining Recommender Request Integration



\## Current state



The Mining page can export a formal request payload as:



`mining\_recommender\_request.json`



The frontend does not calculate recommendation scoring. React only packages user intent.



Current active recommender script:



`D:\\scintel\\scripts\\link\\build\_queue\_recommendation\_fixture.py`



Current generated fixture output:



`D:\\scintel\\scripts\\fixtures\\build\_queue\_recommendation\_fixture.json`



Frontend fixture copy:



Removed. The frontend now calls `POST /api/recommender/recommendations`.



\## Goal



Update `build\_queue\_recommendation\_fixture.py` to accept a formal request JSON.



Future command shape:



```powershell

python "D:\\scintel\\scripts\\link\\build\_queue\_recommendation\_fixture.py" `

&#x20; --api-root "D:\\scintel\\api" `

&#x20; --request "D:\\scintel\\scripts\\fixtures\\mining\_recommender\_request.json" `

&#x20; --output "D:\\scintel\\scripts\\fixtures\\build\_queue\_recommendation\_fixture.json"

