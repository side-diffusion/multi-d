import { json, error } from '@sveltejs/kit';
import { google } from 'googleapis';
import { imagePromptState } from '$lib/stores/imageStore.svelte';

// Initialize Google Sheets API
async function getGoogleSheetsClient() {
	console.log('Google Sheets key file:',import.meta.env.VITE_GOOGLE_APPLICATION_CREDENTIALS_JSON);
	try {
		// Read the key file

		const keyFile = JSON.parse(import.meta.env.VITE_GOOGLE_APPLICATION_CREDENTIALS_JSON);

		// Create a JWT client with proper scopes
		const auth = new google.auth.GoogleAuth({
			credentials: keyFile,
			scopes: [
				'https://www.googleapis.com/auth/spreadsheets',
	
			]
		});

		// Get the client
		const authClient = await auth.getClient();

		// Create and return the sheets client
		return google.sheets({
			version: 'v4',
			auth: authClient
		});
	} catch (err) {
		console.error('Failed to initialize Google Sheets client:', err);
		throw err;
	}
}




// Function to log Flux generation data to Google Sheets
async function logToGoogleSheets(inputText, prompt, imageURL, modelURL, videoURL) {
	try {
		// Get the spreadsheet ID from environment variable
		const spreadsheetId = import.meta.env.VITE_GOOGLE_LOG_SHEET_ID;
        console.log('spreadsheetId', spreadsheetId)

		if (!spreadsheetId) {
			console.error('Google Sheets ID not found in environment variables');
			return;
		}

		// Get sheets client
		const sheets = await getGoogleSheetsClient();

		// Get spreadsheet info to determine the correct sheet name
		const spreadsheetInfo = await sheets.spreadsheets.get({
			spreadsheetId
		});

		// Get the first sheet name
		const firstSheetName = spreadsheetInfo.data.sheets[0].properties.title;

		// Format current date and time
		const now = new Date();
		const requestDate = `${now.getFullYear().toString().slice(2)}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
		const requestTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

		// Prepare the row data
		const values = [[requestDate, requestTime, inputText, prompt, imageURL, modelURL, videoURL]];

		// Append the row to the spreadsheet using the actual sheet name
		await sheets.spreadsheets.values.append({
			spreadsheetId,
			range: `${firstSheetName}!A1:G1`, // Use the actual sheet name
			valueInputOption: 'USER_ENTERED', // Changed from RAW to handle date formatting better
			insertDataOption: 'INSERT_ROWS',
			resource: {
				values
			}
		});

		console.log('Successfully logged to Google Sheets:', { requestDate, requestTime, inputText, prompt, imageURL, modelURL, videoURL });
	} catch (err) {
		console.error('Failed to log to Google Sheets:', err);
		console.error('Error details:', err.errors || err.message || 'Unknown error');
		// Don't throw the error, just log it to avoid disrupting the main API flow
	}
}

// Function to log Flux generation data to Google Sheets
async function logToGoogleSheetsModels(modelUrl, imageUrl, position) {
	try {
		// Get the spreadsheet ID from environment variable
		const spreadsheetId = import.meta.env.VITE_GOOGLE_LOG_SHEET_ID;
        console.log('spreadsheetId', spreadsheetId)

		if (!spreadsheetId) {
			console.error('Google Sheets ID not found in environment variables');
			return;
		}

		// Get sheets client
		const sheets = await getGoogleSheetsClient();

		// Get spreadsheet info to determine the correct sheet name
		const spreadsheetInfo = await sheets.spreadsheets.get({
			spreadsheetId
		});

		// Get the first sheet name
		const SheetName = spreadsheetInfo.data.sheets[1].properties.title;


		// Prepare the row data
		const values = [[modelUrl, imageUrl, position.x, position.y, position.z]];

		// Append the row to the spreadsheet using the actual sheet name
		await sheets.spreadsheets.values.append({
			spreadsheetId,
			range: `${SheetName}!A1:E1`, // Use the actual sheet name
			valueInputOption: 'USER_ENTERED', // Changed from RAW to handle date formatting better
			insertDataOption: 'INSERT_ROWS',
			resource: {
				values
			}
		});

		console.log('Successfully logged to Models Sheets:', { modelUrl, imageUrl, position });
	} catch (err) {
		console.error('Failed to log to Models Sheets:', err);
		console.error('Error details:', err.errors || err.message || 'Unknown error');
		// Don't throw the error, just log it to avoid disrupting the main API flow
	}
}


export async function POST({ request }) {

	//url param 에서 action 확인
	const url = new URL(request.url);
	if(url.searchParams.get('action') === 'updateModelList'){
		const { modelUrl, imageUrl, position } = await request.json();
		console.log('updateModelList', modelUrl, position);

		try {
			//google sheet 에 업데이트
			logToGoogleSheetsModels(modelUrl,imageUrl, position);
		} catch (err) {
			console.error('Failed to log to Models Sheets:', err);
			console.error('Error details:', err.errors || err.message || 'Unknown error');
		}
		return json({ success: true });

	}

    console.log('request', request.body)
	try {
		const { inputText, prompt, imageUrl, modelUrl, videoUrl } = await request.json();
	

		console.log('받은 입력:', inputText, prompt, imageUrl, modelUrl, videoUrl);
 
	try {
			// Asynchronously log to Google Sheets without waiting for completion
			logToGoogleSheets(inputText, prompt, imageUrl, modelUrl, videoUrl).catch((err) =>
				console.error('Google Sheets logging error:', err)
			);


		}catch (error) {
			console.error('Google Sheets logging error:', error);
		}

        return json({ success: true });
    }


	catch (error) {
		console.error('서버 처리 오류:', error);
		return json(
			{
				error: {
					msg: error.message || 'Internal server error'
				}
			},
			{ status: 500 }
		);
	}
}

export async function GET(request) {
const url = new URL(request.url);




	try {
		const spreadsheetId = import.meta.env.VITE_GOOGLE_LOG_SHEET_ID;
		if (!spreadsheetId) {
			return json({ error: 'Google Sheets ID not found in environment variables' }, { status: 500 });
		}

		const sheets = await getGoogleSheetsClient();
		const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
		const firstSheetName = spreadsheetInfo.data.sheets[0].properties.title;
		const secondSheetName = spreadsheetInfo.data.sheets[1].properties.title;

let range;
		if(url.searchParams.get('action') === 'getModelList'){
			 range = `${secondSheetName}!A1:E`;
			
		} else {
		// C열(inputText), D열(prompt)만 가져오기 (A1:G로 데이터 전체를 가져온 뒤 필요한 열만 추출)
		 range = `${firstSheetName}!A1:G`;
	
		}
		
	const response = await sheets.spreadsheets.values.get({
			spreadsheetId,
			range
		});
		const rows = response.data.values || [];
		// 첫 행은 헤더일 수 있으니 제외
		const dataRows = rows.length > 1 ? rows.slice(1) : [];
		const dataCount = dataRows.length;

		if(url.searchParams.get('action') === 'getModelList'){
			const last10 = dataRows.slice(-10).reverse();
			const result = last10.map(row => ({
				modelUrl: row[0] || '',
				imageUrl: row[1] || '',
				position: {
					x: row[2] || 0,
					y: row[3] || 0,	
					z: row[4] || 0
				},
				count: dataCount
			}));
			return json(result);


		}else{
		// 최근 100개만, 최신순으로
		const last100 = dataRows.slice(-100).reverse();
			const result = last100.map(row => ({
			inputText: row[2] || '', // C열
			prompt: row[3] || '',     // D열
		
		}));
			return json({data:result, count: dataCount});
		}



	

	
	} catch (error) {
		console.error('Error fetching Google Sheets data:', error);
		return json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
}

