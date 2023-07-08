const { HierarchicalNSW } = require("hnswlib-node");

const numDimensions = 4096; // the length of data point vector that will be indexed.
const maxElements = 200; // the maximum number of data points.

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

// // declaring and intializing index.
// var index = new HierarchicalNSW("l2", numDimensions);
// index.initIndex(maxElements);
//
// // inserting data points to index.
// for (let i = 0; i < maxElements; i++) {
//   const point = generateRandomVectors(1, 4096)[0];
//   index.addPoint(point, i);
// }
//
// // saving index.
// index.writeIndexSync("foo.dat");

// loading index.
const index = new HierarchicalNSW("l2", numDimensions);
index.readIndexSync("foo.dat");

// preparing query data points.
const query = generateRandomVectors(1, 4096)[0];

// searching k-nearest neighbor data points.
const numNeighbors = 3;
const result = index.searchKnn(query, numNeighbors);

console.table(result);
console.log(index.getPoint(result["neighbors"][0]));
