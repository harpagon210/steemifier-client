const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const WebpackShellPlugin = require('webpack-shell-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const Dotenv = require('dotenv-webpack');

const config = {
  context: __dirname + '/src',
  entry: {
    'background': './background.js',
    'popup/popup': './popup/js/popup.js',
    'steemifier/steemifier': './steemifier/js/steemifier.js',
    'pages/add/add': './pages/add/js/add.js'
  },
  output: {
    path: __dirname + '/dist',
    filename: '[name].js'
  },
  resolve: {
    extensions: ['.js'],
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: [
          "babel-loader",
          "eslint-loader",
        ],
      },
      {
        test: /\.sass$/,
        use: [{
            loader: "style-loader" // translates CSS into CommonJS
        },{
            loader: "css-loader" // translates CSS into CommonJS
        }, {
            loader: "sass-loader" // compiles Sass to CSS
        }]
      },
      {
        test: /\.scss$/,
        use: ExtractTextPlugin.extract({
          use: [{
            loader: "css-loader" // translates CSS into CommonJS
        }, {
            loader: "sass-loader" // compiles Sass to CSS
        }]})
      },
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          use: 'css-loader'
        })
      },
      {
        test: /\.(png|jpg|gif|svg|ico)$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]?emitFile=false'
        }
      }
    ],
  },
  plugins: [
    new ExtractTextPlugin({
      filename: '[name].css'
    }),
    new CopyWebpackPlugin([
      {from: 'icons', to: 'icons', ignore: ['icon.xcf']},
      {from: 'popup/popup.html', to: 'popup/popup.html'},
      {from: 'pages/add/index.html', to: 'pages/add/index.html'},
      {from: 'manifest.json', to: 'manifest.json'},
    ]),
    new WebpackShellPlugin({
      onBuildEnd: ['node scripts/remove-evals.js']
    }),
    new Dotenv({
      path: 'variables.env'
    }),
  ]
};

if (process.env.NODE_ENV === 'production') {
  config.devtool = '#cheap-module-source-map';

  config.plugins = (config.plugins || []).concat([
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: '"production"'
      }
    }),
    /* new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      },
       output: {
        ascii_only: true,
        beautify: false,
      }
    }), */
    new webpack.LoaderOptionsPlugin({
      minimize: true
    })
  ]);
}

module.exports = config;
