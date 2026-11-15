@echo off
curl.exe -s -A "railway-cli/5.2.0" -X POST "https://backboard.railway.app/graphql/v2" -H "Content-Type: application/json" -H "Project-Access-Token: 811f3c9f-5da4-4999-86ed-12fb2bcdcd2f" --data-binary "@.tmp-railway-query.json"
echo.
echo EXIT=%ERRORLEVEL%
