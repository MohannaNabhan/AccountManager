const exec = require("child_process").exec;

document.getElementById("minimize-btn").addEventListener("click", (e) => {
  ipcRenderer.send("event:window", "minimize");
});
document.getElementById("maximize-btn").addEventListener("click", (e) => {
  if (
    document.getElementById("maximize-btn").innerHTML ==
    '<i style="margin-top: 8px;" class="fal fa-rectangle-landscape"></i>'
  ) {
    ipcRenderer.send("event:window", "maximize");
    document.getElementById(
      "maximize-btn"
    ).innerHTML = `<i style="margin-top: 8px; transform: rotate(180deg);" class="far fa-clone"></i>`;
  } else {
    ipcRenderer.send("event:window", "unmaximize");
    document.getElementById(
      "maximize-btn"
    ).innerHTML = `<i style="margin-top: 8px;" class="fal fa-rectangle-landscape"></i>`;
  }
});
document.getElementById("close-btn").addEventListener("click", (e) => {
  ipcRenderer.send("event:window", "close");
});
let alert_ = document.getElementById("alert");
let notification_active = false;
let notification_timer = 0;
function notification(type, data) {
  alert_.classList.add("alert-show");
  notification_timer = 23;
  notification_active = true;
  if (type == "Alert:ERROR") {
    alert_.innerHTML = `<i class="fad fa-times-circle"></i>
        <h1>${data}</1h>`;
    alert_.style.background = "#A5104CFF";
  } else if (type == "Alert:GOOD") {
    alert_.innerHTML = `<i class="fad fa-badge-check"></i>
        <h1>${data}</1h>`;
    alert_.style.background = "#379100FF";
  } else if (type == "Alert:WARNING") {
    alert_.innerHTML = `<i class="fad fa-exclamation-triangle"></i>
        <h1>${data}</1h>`;
    alert_.style.background = "#FF9100FF";
  }
}
setInterval(() => {
  if (notification_active) {
    if (notification_timer < 1) {
      alert_.classList.remove("alert-show");
      notification_active = false;
    } else {
      notification_timer--;
    }
  }
}, 100);
var input = document.querySelector("body");
input.addEventListener("keyup", function (event) {
  if (event.keyCode === 116) {
    location.reload(true);
  }
});
function word_random(length) {
  let chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789$%&€#";
  let str = "";
  for (let i = 0; i < length; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return str;
}

const path_db = "C:/AccountManager";
let category_load = null;
let list_category = [""];

function window_events(title, data) {
  document
    .getElementById("window-info-back-full")
    .classList.add("visible-window-info");
  document
    .getElementById("window-info-back")
    .classList.add("visible-window-info");
  document.querySelectorAll(".close-window").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .getElementById("window-info-back-full")
        .classList.remove("visible-window-info");
      document
        .getElementById("window-info-back")
        .classList.remove("visible-window-info");
    });
  });
  document.querySelector("#window-info-header h1").textContent = title;
  if (title == "Create New Category") {
    document.getElementById("window-info-body").innerHTML = `
            <div class="input-back">
                <i class="icon fad fa-signature"></i>
                <input type="text" id="name" placeholder="Category Name">
                </div>
            <button id="create-category" class="btn-event">Create</button>
        `;
    document
      .getElementById("create-category")
      .addEventListener("click", (e) => {
        file_search_result = false;
        if (e.target.parentElement.querySelector("#name").value == "") {
          notification("Alert:ERROR", "Insert Category Name");
        } else if (
          !e.target.parentElement
            .querySelector("#name")
            .value.match(/^[0-9a-zA-Z ?=.]+$/)
        ) {
          notification("Alert:WARNING", "Invalid Category Name");
        } else {
          for (let i = 0; i < list_category.length; i++) {
            if (
              e.target.parentElement.querySelector("#name").value ==
              list_category[i]
            ) {
              file_search_result = true;
              notification("Alert:WARNING", "Category already exists");
            }
            if (i > list_category.length - 2 && !file_search_result) {
              document
                .getElementById("window-info-back-full")
                .classList.remove("visible-window-info");
              document
                .getElementById("window-info-back")
                .classList.remove("visible-window-info");
              exec(
                `mkdir "C:\\AccountManager\\Category\\${
                  e.target.parentElement.querySelector("#name").value
                }"`
              );
              notification("Alert:GOOD", "New category added");
              setTimeout(() => {
                location.reload(true);
              }, 500);
            }
          }
        }
      });
  } else if (title == "Edit Category") {
    document.getElementById("window-info-body").innerHTML = `
            <div class="input-back">
            <i class="icon fad fa-money-check-edit"></i>
            <input type="text" id="name" placeholder="Category Name" value="${
              data.querySelector("h1").textContent
            }">
            </div>
            <button id="edit-category" class="btn-event">Save</button>
            <button id="delete-category" style="left: 10px !important;" class="btn-event">Delete</button>
        `;
    document.getElementById("edit-category").addEventListener("click", (e) => {
      file_search_result = false;
      for (let i = 0; i < list_category.length; i++) {
        if (
          e.target.parentElement.querySelector("#name").value ==
          list_category[i]
        ) {
          file_search_result = true;
          notification("Alert:WARNING", "Category already exists");
        }
        if (i > list_category.length - 2 && !file_search_result) {
          if (
            !e.target.parentElement
              .querySelector("#name")
              .value.match(/^[0-9a-zA-Z ?=.]+$/)
          ) {
            notification("Alert:WARNING", "Invalid Category Name");
          } else {
            fs.rename(
              path_db + "/Category/" + data.querySelector("h1").textContent,
              path_db +
                "/Category/" +
                e.target.parentElement.querySelector("#name").value,
              function (err) {
                if (err) {
                  notification("Alert:ERROR", "Can't Rename Category");
                } else {
                  document
                    .getElementById("window-info-back-full")
                    .classList.remove("visible-window-info");
                  document
                    .getElementById("window-info-back")
                    .classList.remove("visible-window-info");
                  notification("Alert:GOOD", "Category has been renamed");
                  setTimeout(() => {
                    location.reload(true);
                  }, 500);
                }
              }
            );
          }
        }
      }
    });
    document
      .getElementById("delete-category")
      .addEventListener("click", (e) => {
        fs.rmdir(
          path_db + "/Category/" + data.querySelector("h1").textContent,
          { recursive: true },
          (err) => {
            if (err) {
              notification("Alert:ERROR", "Can't Delete Category");
            } else {
              document
                .getElementById("window-info-back-full")
                .classList.remove("visible-window-info");
              document
                .getElementById("window-info-back")
                .classList.remove("visible-window-info");
              notification("Alert:GOOD", "Category Deleted");
              setTimeout(() => {
                location.reload(true);
              }, 500);
            }
          }
        );
      });
  } else if (title == "Create New Account") {
    document.getElementById("window-info-body").innerHTML = `
            <div class="input-back">
                <i class="icon fad fa-concierge-bell"></i>
                <input type="text" id="service" placeholder="Service Name">
            </div>
            <div style="margin-top: 50px;" class="input-back">
                <i class="icon fad fa-user"></i>
                <input type="text" id="email" placeholder="Email or Username">
            </div>
            <div style="margin-top: 100px;" class="input-back">
                <i class="icon fad fa-key"></i>
                <input type="password" id="password" placeholder="Password">
                  <i class="icon-function fal fa-eye-slash"></i>
            </div>
            <button style="top: 160px !important; right: 30px; background-color: transparent; width: 150px;" id="generate-pass-account" class="btn-event">Generate Password</button>
            <button id="save-account" class="btn-event">Create</button>
        `;
    document
      .getElementById("generate-pass-account")
      .addEventListener("click", (e) => {
        e.target.parentElement.querySelector("#password").value =
          word_random(20);
      });
    document.querySelector(".icon-function").addEventListener("click", (e) => {
      if (e.target.parentElement.querySelector("#password").type == "text") {
        e.target.parentElement.querySelector("#password").type = "password";
        document.querySelector(".icon-function").classList.remove("fa-eye");
        document.querySelector(".icon-function").classList.add("fa-eye-slash");
      } else {
        e.target.parentElement.querySelector("#password").type = "text";
        document
          .querySelector(".icon-function")
          .classList.remove("fa-eye-slash");
        document.querySelector(".icon-function").classList.add("fa-eye");
      }
    });
    document.getElementById("save-account").addEventListener("click", (e) => {
      let service = e.target.parentElement.querySelector("#service").value;
      let user = e.target.parentElement.querySelector("#email").value;
      let password = e.target.parentElement.querySelector("#password").value;
      if (user == "" && service == "") {
        notification("Alert:ERROR", "Insert Information");
      } else if (service == "") {
        notification("Alert:WARNING", "Insert Service");
      } else if (user == "") {
        notification("Alert:WARNING", "Insert Email or Username");
      } else if (!service.match(/^[0-9a-zA-Z ?=.]+$/)) {
        notification("Alert:WARNING", "Service has an Invalid Character");
      } else {
        fs.writeFile(
          path_db +
            "/Category/" +
            category_load +
            "/" +
            word_random(7) +
            ".AccountManager",
          `${service}|/|${user}|/|${password}`,
          function (err) {
            if (err) {
              notification("Alert:ERROR", "Can't Create New Account");
            } else {
              document
                .getElementById("window-info-back-full")
                .classList.remove("visible-window-info");
              document
                .getElementById("window-info-back")
                .classList.remove("visible-window-info");
              setTimeout(() => {
                let back_category = category_load;
                category_load = "";
                draw_accounts(back_category);
                notification("Alert:GOOD", "New Account Created");
              }, 100);
            }
          }
        );
      }
    });
  } else if (title == "View Information") {
    file_name = data.querySelector("#file-name").textContent;
    fs.readFile(
      path_db +
        "/Category/" +
        category_load +
        "/" +
        data.querySelector("#file-name").textContent,
      "utf8",
      (err, data) => {
        if (!err) {
          document.getElementById("window-info-body").innerHTML = `
                    <div class="input-back">
                    <i class="icon fad fa-concierge-bell"></i>
                    <input type="text" disabled="disabled" value="${
                      data.split("|/|")[0]
                    }">
                    </div>
                    <div style="margin-top: 50px;" class="input-back">
                    <i class="icon fad fa-user"></i>
                    <input type="text" id="email" disabled="disabled" value="${
                      data.split("|/|")[1]
                    }">
                    <i class="icon-function fal fal fa-copy"></i>
                    </div>
                    <div style="margin-top: 100px;" class="input-back">
                    <i class="icon fad fa-key"></i>
                    <input type="password" id="password" disabled="disabled" value="${
                      data.split("|/|")[2]
                    }">
                    <i class="icon-function fal fal fa-copy"></i>
                    </div>
                    <button id="edit-account" class="btn-event">Edit</button>
                `;
          document.querySelectorAll(".icon-function").forEach((btn) => {
            btn.addEventListener("click", (e) => {
              navigator.clipboard.writeText(
                e.target.parentElement.querySelector("input").value
              );
            });
          });
          document
            .querySelector("#edit-account")
            .addEventListener("click", (e) => {
              window_events("Edit Information", file_name);
            });
        }
      }
    );
  } else if (title == "Edit Information") {
    let file_name = data;
    fs.readFile(
      path_db + "/Category/" + category_load + "/" + data,
      "utf8",
      (err, data) => {
        if (!err) {
          document.getElementById("window-info-body").innerHTML = `
                <div class="input-back">
                    <i class="icon fad fa-concierge-bell"></i>
                    <input type="text" id="service" placeholder="Service Name" value="${
                      data.split("|/|")[0]
                    }">
                </div>
                <div style="margin-top: 50px;" class="input-back">
                    <i class="icon fad fa-user"></i>
                    <input type="text" id="email" placeholder="Email or Username" value="${
                      data.split("|/|")[1]
                    }">
                </div>
                <div style="margin-top: 100px;" class="input-back">
                    <i class="icon fad fa-key"></i>
                    <input type="password" id="password" placeholder="Password" value="${
                      data.split("|/|")[2]
                    }">
                    <i class="icon-function fal fa-eye-slash"></i>
                </div>
                <button style="top: 160px !important; right: 30px; background-color: transparent; width: 150px;" id="generate-pass-account" class="btn-event">Generate Password</button>
                <button id="save-account" class="btn-event">Save</button>
                <button style="left:10px !important;"; id="delete-account" class="btn-event">Delete</button>
                `;
          document
            .getElementById("generate-pass-account")
            .addEventListener("click", (e) => {
              e.target.parentElement.querySelector("#password").value =
                word_random(20);
            });
          document
            .querySelector(".icon-function")
            .addEventListener("click", (e) => {
              if (
                e.target.parentElement.querySelector("#password").type == "text"
              ) {
                e.target.parentElement.querySelector("#password").type =
                  "password";
                document
                  .querySelector(".icon-function")
                  .classList.remove("fa-eye");
                document
                  .querySelector(".icon-function")
                  .classList.add("fa-eye-slash");
              } else {
                e.target.parentElement.querySelector("#password").type = "text";
                document
                  .querySelector(".icon-function")
                  .classList.remove("fa-eye-slash");
                document
                  .querySelector(".icon-function")
                  .classList.add("fa-eye");
              }
            });
          document
            .querySelector("#save-account")
            .addEventListener("click", (e) => {
              let service =
                e.target.parentElement.querySelector("#service").value;
              let user = e.target.parentElement.querySelector("#email").value;
              let password =
                e.target.parentElement.querySelector("#password").value;
              if (user == "" && service == "") {
                notification("Alert:ERROR", "Insert Information");
              } else if (service == "") {
                notification("Alert:WARNING", "Insert Service");
              } else if (user == "") {
                notification("Alert:WARNING", "Insert Email or Username");
              } else if (!service.match(/^[0-9a-zA-Z ?=.]+$/)) {
                notification(
                  "Alert:WARNING",
                  "Service has an Invalid Character"
                );
              } else {
                fs.writeFile(
                  path_db + "/Category/" + category_load + "/" + file_name,
                  `${service}|/|${user}|/|${password}`,
                  function (err) {
                    if (err) {
                      notification("Alert:ERROR", "Can't Create New Account");
                    } else {
                      document
                        .getElementById("window-info-back-full")
                        .classList.remove("visible-window-info");
                      document
                        .getElementById("window-info-back")
                        .classList.remove("visible-window-info");
                      setTimeout(() => {
                        let back_category = category_load;
                        category_load = "";
                        draw_accounts(back_category);
                        notification("Alert:GOOD", "Saved Information");
                      }, 100);
                    }
                  }
                );
              }
            });
          document
            .querySelector("#delete-account")
            .addEventListener("click", (e) => {
              fs.unlink(
                path_db + "/Category/" + category_load + "/" + file_name,
                (err) => {
                  if (err) {
                    notification("Alert:ERROR", "Can't Delete Account");
                    console.error(err);
                  } else {
                    document
                      .getElementById("window-info-back-full")
                      .classList.remove("visible-window-info");
                    document
                      .getElementById("window-info-back")
                      .classList.remove("visible-window-info");
                    notification("Alert:GOOD", "Account Deleted");
                    setTimeout(() => {
                      let back_category = category_load;
                      category_load = "";
                      draw_accounts(back_category);
                      notification("Alert:GOOD", "Account Deleted");
                    }, 100);
                  }
                }
              );
            });
        }
      }
    );
  }
}
function draw_accounts(category) {
  if (category != category_load) {
    document.getElementById("account-information-back").innerHTML = ``;
    fs.readdir(path_db + "/Category/" + category, function (err, files) {
      if (!err) {
        let file_load = 0;
        document.getElementById("account-information-back").innerHTML += `
                            <button class="account-information-item account-add">
                                <h1>+</h1>
                            </button>
                        `;
        setTimeout(() => {
          document
            .querySelector(".account-add")
            .addEventListener("click", (e) => {
              window_events("Create New Account", "");
            });
        },100);
        for (i = 0; i < files.length; i++) {
          if (
            files[i].charAt(files[i].length - 15) +
              files[i].charAt(files[i].length - 14) +
              files[i].charAt(files[i].length - 7) ==
            ".AM"
          ) {
            let file_name = files[i];
            fs.readFile(
              path_db + "/Category/" + category + "/" + files[i],
              "utf8",
              (err, data) => {
                if (!err) {
                  document.getElementById(
                    "account-information-back"
                  ).innerHTML += `
                                   <button class="account-information-item account-view">
                                       <i class="icon fad fa-user"></i>
                                       <h1 id="file-name" hidden>${file_name}</h1>
                                       <h1>${data.split("|/|")[0]}</h1>
                                       <h2>Email: ${"*".repeat(
                                         Math.floor(
                                           Math.random() * (30 - 8 + 1)
                                         ) + 8
                                       )}</h2>
                                       <h3>Password: ${"*".repeat(
                                         Math.floor(
                                           Math.random() * (25 - 5 + 1)
                                         ) + 5
                                       )}</h3>
                                       <i class="icon-2 fad fa-angle-right"></i>
                                   </button>
                                `;
                  file_load++;
                }
              }
            );
          } else {
            console.error("Account File Invalid: " + files[i]);
          }
        }
        setTimeout(() => {
          if (file_load > files.length - 2) {
            document.querySelectorAll(".account-view").forEach((btn) => {
              btn.addEventListener("click", (e) => {
                if (e.target.classList.contains("account-view")) {
                  window_events("View Information", e.target);
                } else if (
                  e.target.parentElement.classList.contains("account-view")
                ) {
                  window_events("View Information", e.target.parentElement);
                }
              });
            });
          }
        }, 100);
      } else {
        notification("Alert:ERROR", "Unable to access category folder");
      }
    });
    category_load = category;
  }
}
function draw_category() {
  fs.readdir(path_db + "/Category", function (err, files) {
    if (!err) {
      document.getElementById("number-category").innerHTML = `${files.length}`;
      document.getElementById("category-list-item-back").innerHTML = ``;
      if (files.length < 1) {
        document.getElementById("category-list-item-back").innerHTML += `
                    <div class="add-category category-list-item">
                        <h2>+</h2>
                    </div>
                `;
        document
          .querySelector(".add-category")
          .addEventListener("click", (e) => {
            window_events("Create New Category", e.target.parentElement);
          });
      } else {
        list_category = files;
        files.sort();

        document.getElementById("category-list-item-back").innerHTML += `
                            <div class="add-category category-list-item">
                                <h2>+</h2>
                            </div>
                        `;
        setTimeout(() => {
          document
            .querySelector(".add-category")
            .addEventListener("click", (e) => {
              window_events("Create New Category", e.target.parentElement);
            });
        }, 100);

        for (i = 0; i < files.length; i++) {
          if (files[i].match(/^[0-9a-zA-Z ?=.]+$/)) {
            document.getElementById("category-list-item-back").innerHTML += `
                            <div class="view-category category-list-item">
                                <h1 hidden>${files[i]}</h1> 
                                <h2>${
                                  files[i].length > 21
                                    ? files[i].slice(0, 21 - 3) + "..."
                                    : files[i]
                                }</h2> 
                                <i class="edit-category fad fa-pencil-alt"></i>
                            </div>
                        `;
          } else {
            console.error("Invalid File: " + files[i]);
          }
          if (i > files.length - 2) {
            document.querySelectorAll(".view-category").forEach((btn) => {
              btn.addEventListener("click", (e) => {
                draw_accounts(e.target.querySelector("h1").textContent);
              });
            });
            document.querySelectorAll(".edit-category").forEach((btn) => {
              btn.addEventListener("click", (e) => {
                window_events("Edit Category", e.target.parentElement);
              });
            });
          }
        }
        if (files[0]) {
          draw_accounts(files[0]);
        }
      }
    } else {
      notification("Alert:ERROR", "Unable to access category folder");
    }
  });
}
draw_category();
