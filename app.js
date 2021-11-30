const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbpath = path.join(__dirname, "covid19IndiaPortal.db");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

let db = null;

const initializeDBandServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
  }
};
initializeDBandServer();

/// ***** API's  with Authenticate Token Middleware ***** ///

//Authentication with Token

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "secret_token", async (error, payload, next) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//coverting state object to db response object

const convertStateObjectToDbObject = (stateObject) => {
  return {
    stateId: stateObject.state_id,
    stateName: stateObject.state_name,
    population: stateObject.population,
  };
};

//converting district object to db response object

convertDistrictObjTODbObject = (districtObject) => {
  return {
    districtId: districtObject.district_id,
    districtName: districtObject.district_name,
    stateId: districtObject.state_id,
    cases: districtObject.cases,
    cured: districtObject.cured,
    active: districtObject.active,
    deaths: districtObject.deaths,
  };
};

// Login User API by generating the JWT Token

app.post("/login/", authenticateToken, async (request, response) => {
  const { username, password } = request.body;

  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordCorrect = await bcrypt.compare(
      request.body.password,
      dbUser.password
    );
    if (isPasswordCorrect) {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "secret_token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//get states list API

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = ` SELECT * FROM state`;
  const statesArray = await db.all(getStatesQuery);
  response.send(
    statesArray.map((eachObject) => convertStateObjectToDbObject(eachObject))
  );
});

// get state based on state id API
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
        SELECT 
            * 
        FROM 
            state 
        WHERE 
            state_id = ${stateId};
    `;
  const stateArray = await db.get(getStateQuery);
  response.send(convertStateObjectToDbObject(stateArray));
});

//create district in district table API

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrict = `
        INSERT INTO 
            district (district_name, state_id, cases, cured, active, deaths)
        VALUES 
            ('${districtName}', ${stateId},${cases}, ${cured}, ${active}, ${deaths});
    `;
  await db.run(createDistrict);
  response.send("District Successfully Added");
});

//return district based on district Id API

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
        SELECT * 
        FROM 
            district
        WHERE 
            district_id = ${districtId}
    `;
    const districtsArray = await db.get(getDistrictQuery);
    response.send(convertDistrictObjTODbObject(districtsArray));
  }
);

// delete district based on district id API

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
        DELETE FROM 
            district 
        WHERE 
            district_id = ${districtId}
    `;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//update districts of the district table  based on the district id API
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
        UPDATE 
            district 
        SET         
            district_name= '${districtName}',
            state_id= ${stateId},
            cases= ${cases},
            cured= ${cured},
            active= ${active},
            deaths = ${deaths}
    WHERE 
        district_id = ${districtId};
    `;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//stats  of total deaths, cured API with Authenticate Token Middleware

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statsQuery = `
        SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured, SUM(active) AS totalActive, 
            SUM(deaths) AS totalDeaths
        FROM district 
        WHERE state_id = ${stateId};
    `;
    const statsArray = await db.get(statsQuery);
    response.send(statsArray);
  }
);

module.exports = app;
