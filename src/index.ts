/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { endGroup, getInput, setFailed, startGroup } from "@actions/core";
import { existsSync } from "fs";
import { createGacFile } from "./createGACFile";
import { deployProductionSite } from "./deploy";

// Inputs defined in action.yml
const projectId = getInput("projectId");
const googleApplicationCredentials = getInput("firebaseServiceAccount", {
  required: true,
});
const entryPoint = getInput("entryPoint");
const firebaseToolsVersion = getInput("firebaseToolsVersion");

async function run() {
  let finish = (details: Object) => console.log(details);

  try {
    startGroup("Verifying firebase.json exists");

    if (entryPoint !== ".") {
      console.log(`Changing to directory: ${entryPoint}`);
      try {
        process.chdir(entryPoint);
      } catch (err) {
        throw Error(`Error changing to directory ${entryPoint}: ${err}`);
      }
    }

    if (existsSync("./firebase.json")) {
      console.log("firebase.json file found. Continuing deploy.");
    } else {
      throw Error(
        "firebase.json file not found. If your firebase.json file is not in the root of your repo, edit the entryPoint option of this GitHub action."
      );
    }
    endGroup();

    startGroup("Setting up CLI credentials");
    const gacFilename = await createGacFile(googleApplicationCredentials);
    console.log(
      "Created a temporary file with Application Default Credentials."
    );
    endGroup();

    startGroup("Deploying to production site");
    // TODO refactor deployProductionSite to deploy firebase functions instead of hosting
    const deployment = await deployProductionSite(gacFilename, {
      projectId,
      firebaseToolsVersion,
    });
    if (deployment.status === "error") {
      throw Error(deployment.error);
    }
    endGroup();

    const hostname = `${projectId}.web.app`;
    const url = `https://${hostname}/`;
    await finish({
      details_url: url,
      conclusion: "success",
      output: {
        title: `Production deploy succeeded`,
        summary: `[${hostname}](${url})`,
      },
    });
    return;
  } catch (e) {
    setFailed(e.message);

    await finish({
      conclusion: "failure",
      output: {
        title: "Deploy functions failed",
        summary: `Error: ${e.message}`,
      },
    });
  }
}

run();
