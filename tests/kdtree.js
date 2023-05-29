//Import library
var createKDTree = require("static-kdtree"),
  { performance } = require("perf_hooks");

function generateRandomVectors(k, n) {
  // Generate an array of k * n random numbers between 0 and 1
  const randomNumbers = Array.from({ length: k * n }, () => Math.random());

  // Convert the array of random numbers to an array of k random vectors with n dimensions
  const randomVectors = Array.from({ length: k }, (_, i) => {
    const randomVector = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      randomVector[j] = randomNumbers[i * n + j];
    }
    return randomVector;
  });

  return randomVectors;
}

//Create a bunch of points
var points = generateRandomVectors(1500, 4096);

//Create the tree
var startTime = performance.now(),
  tree = createKDTree(points),
  vector = generateRandomVectors(1, 4096)[0];

//Nearest neighbor queries
console.log(
  `[${tree.length}, ${tree.dimension}] closest point to ${vector
    .join(",")
    .slice(0, 100)} is ${points[tree.nn(vector)].join(",").slice(0, 100)}`
);
console.log(performance.now() - startTime + " ms");

//For performance, be sure to delete tree when you are done with it
tree.dispose();
