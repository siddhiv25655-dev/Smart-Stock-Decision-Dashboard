// function login() {
//   const user = document.getElementById("username").value;
//   const pass = document.getElementById("password").value;

//   if (user === "admin" && pass === "1234") {
//     localStorage.setItem("loggedIn", "true");
//     window.location.href = "home.html";
//   } else {
//     alert("Invalid credentials ❌");
//   }
// }
function signup() {
  const user = document.getElementById("newUser").value;
  const pass = document.getElementById("newPass").value;

  if (!user || !pass) {
    alert("Please fill all fields ❌");
    return;
  }

  // store user
  localStorage.setItem("username", user);
  localStorage.setItem("password", pass);

  alert("Signup successful ✅");
  window.location.href = "index.html";
}

function login() {
  const user = document.getElementById("username").value;
  const pass = document.getElementById("password").value;

  const storedUser = localStorage.getItem("username");
  const storedPass = localStorage.getItem("password");

  if (user === storedUser && pass === storedPass) {
    localStorage.setItem("loggedIn", "true");
    window.location.href = "home.html";
  } else {
    alert("Invalid credentials ❌");
  }
}

function goToLogin() {
  window.location.href = "index.html";
}

function goToSignup() {
  window.location.href = "signup.html";
}