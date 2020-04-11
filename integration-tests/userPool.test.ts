import { CreateDataStore, createDataStore } from "../src/services/dataStore";
import { createUserPool, UserPool } from "../src/services/userPool";
import fs from "fs";
import { promisify } from "util";

const mkdtemp = promisify(fs.mkdtemp);
const readFile = promisify(fs.readFile);
const rmdir = promisify(fs.rmdir);

describe("User Pool", () => {
  let path: string;
  let tmpCreateDataStore: CreateDataStore;

  beforeEach(async () => {
    path = await mkdtemp("/tmp/cognito-local:");
    tmpCreateDataStore = (id, defaults) => createDataStore(id, defaults, path);
  });

  afterEach(() =>
    rmdir(path, {
      recursive: true,
    })
  );

  it("creates a database", async () => {
    await createUserPool({ UsernameAttributes: [] }, tmpCreateDataStore);

    expect(fs.existsSync(path + "/local.json")).toBe(true);
  });

  describe("saveUser", () => {
    it("saves a user with their username as an additional attribute", async () => {
      const now = new Date().getTime();
      const dataStore = await createUserPool(
        { UsernameAttributes: [] },
        tmpCreateDataStore
      );

      await dataStore.saveUser({
        Username: "1",
        Password: "hunter3",
        UserStatus: "UNCONFIRMED",
        Attributes: [{ Name: "email", Value: "example@example.com" }],
        UserLastModifiedDate: now,
        UserCreateDate: now,
        Enabled: true,
      });

      const file = JSON.parse(await readFile(path + "/local.json", "utf-8"));

      expect(file).toEqual({
        Options: { UsernameAttributes: [] },
        Users: {
          "1": {
            Username: "1",
            Password: "hunter3",
            UserStatus: "UNCONFIRMED",
            Attributes: [
              { Name: "sub", Value: "1" },
              { Name: "email", Value: "example@example.com" },
            ],
            UserLastModifiedDate: now,
            UserCreateDate: now,
            Enabled: true,
          },
        },
      });
    });

    it("updates a user", async () => {
      const now = new Date().getTime();
      const dataStore = await createUserPool(
        { UsernameAttributes: [] },
        tmpCreateDataStore
      );

      await dataStore.saveUser({
        Username: "1",
        Password: "hunter3",
        UserStatus: "UNCONFIRMED",
        ConfirmationCode: "1234",
        Attributes: [{ Name: "email", Value: "example@example.com" }],
        UserLastModifiedDate: now,
        UserCreateDate: now,
        Enabled: true,
      });

      let file = JSON.parse(await readFile(path + "/local.json", "utf-8"));

      expect(file).toEqual({
        Options: { UsernameAttributes: [] },
        Users: {
          "1": {
            Username: "1",
            Password: "hunter3",
            UserStatus: "UNCONFIRMED",
            ConfirmationCode: "1234",
            Attributes: [
              { Name: "sub", Value: "1" },
              { Name: "email", Value: "example@example.com" },
            ],
            UserLastModifiedDate: now,
            UserCreateDate: now,
            Enabled: true,
          },
        },
      });

      await dataStore.saveUser({
        Username: "1",
        Password: "hunter3",
        UserStatus: "CONFIRMED",
        Attributes: [{ Name: "email", Value: "example@example.com" }],
        UserLastModifiedDate: now,
        UserCreateDate: now,
        Enabled: true,
      });

      file = JSON.parse(await readFile(path + "/local.json", "utf-8"));

      expect(file).toEqual({
        Options: { UsernameAttributes: [] },
        Users: {
          "1": {
            Username: "1",
            Password: "hunter3",
            UserStatus: "CONFIRMED",
            Attributes: [
              { Name: "sub", Value: "1" },
              { Name: "email", Value: "example@example.com" },
            ],
            UserLastModifiedDate: now,
            UserCreateDate: now,
            Enabled: true,
          },
        },
      });
    });
  });

  describe("getUserByUsername", () => {
    describe.each`
      username_attributes          | find_by_email | find_by_phone_number
      ${[]}                        | ${false}      | ${false}
      ${["email"]}                 | ${true}       | ${false}
      ${["phone_number"]}          | ${false}      | ${true}
      ${["email", "phone_number"]} | ${true}       | ${true}
    `(
      "$username_attributes username attributes",
      ({ username_attributes, find_by_email, find_by_phone_number }) => {
        let dataStore: UserPool;

        beforeAll(async () => {
          dataStore = await createUserPool(
            { UsernameAttributes: username_attributes },
            tmpCreateDataStore
          );

          await dataStore.saveUser({
            Username: "1",
            Password: "hunter2",
            UserStatus: "UNCONFIRMED",
            Attributes: [
              { Name: "email", Value: "example@example.com" },
              { Name: "phone_number", Value: "0411000111" },
            ],
            UserCreateDate: new Date().getTime(),
            UserLastModifiedDate: new Date().getTime(),
            Enabled: true,
          });
        });

        it("returns null if user doesn't exist", async () => {
          const user = await dataStore.getUserByUsername("invalid");

          expect(user).toBeNull();
        });

        it("returns existing user by their sub attribute", async () => {
          const user = await dataStore.getUserByUsername("1");

          expect(user).not.toBeNull();
          expect(user?.Username).toEqual("1");
        });

        if (find_by_email) {
          it("returns existing user by their email", async () => {
            const user = await dataStore.getUserByUsername(
              "example@example.com"
            );

            expect(user).not.toBeNull();
            expect(user?.Username).toEqual("1");
          });
        } else {
          it("does not return the user by their email", async () => {
            const user = await dataStore.getUserByUsername(
              "example@example.com"
            );

            expect(user).toBeNull();
          });
        }

        if (find_by_phone_number) {
          it("returns existing user by their phone number", async () => {
            const user = await dataStore.getUserByUsername("0411000111");

            expect(user).not.toBeNull();
            expect(user?.Username).toEqual("1");
          });
        } else {
          it("does not return the user by their phone number", async () => {
            const user = await dataStore.getUserByUsername("0411000111");

            expect(user).toBeNull();
          });
        }
      }
    );
  });
});
